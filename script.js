(() => {
  const config = window.PROJECT_DEMO;
  let selectedContent = null;
  let selectedStyle = null;
  let generationToken = 0;

  const contentGrid = document.getElementById("content-grid");
  const styleGrid = document.getElementById("style-grid");
  const generateBtn = document.getElementById("generate-btn");
  const clearBtn = document.getElementById("clear-btn");
  const resultPlaceholder = document.getElementById("result-placeholder");
  const resultView = document.getElementById("result-view");
  const resultImage = document.getElementById("result-image");
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingTitle = document.getElementById("loading-title");
  const loadingSubtitle = document.getElementById("loading-subtitle");
  const progressBar = document.getElementById("progress-bar");
  const progressLabel = document.getElementById("progress-label");
  const statusTitle = document.getElementById("status-title");
  const statusDetail = document.getElementById("status-detail");

  function renderGrid(items, grid, kind) {
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb-card";
      button.dataset.kind = kind;
      button.dataset.id = item.id;
      button.setAttribute("aria-label", `${kind}: ${item.label}`);
      button.innerHTML = `<img src="${item.src}" alt="${item.label}"><span class="thumb-label">${item.label}</span>`;
      button.addEventListener("click", () => selectItem(kind, item, button));
      grid.appendChild(button);
    });
  }

  function selectItem(kind, item, button) {
    const grid = kind === "content" ? contentGrid : styleGrid;
    grid.querySelectorAll(".thumb-card").forEach((el) => el.classList.remove("selected"));
    button.classList.add("selected");

    if (kind === "content") selectedContent = item;
    else selectedStyle = item;

    generateBtn.disabled = !(selectedContent && selectedStyle);

    if (!resultView.classList.contains("hidden")) {
      resultView.classList.add("hidden");
      resultPlaceholder.classList.remove("hidden");
      statusTitle.textContent = "Selection changed";
      statusDetail.textContent = "Press Generate to load the matching result.";
    }
  }

  function candidatePaths(contentId, styleId) {
    const stem = `${config.resultDirectory}/ortho_${contentId}_${styleId}`;
    return config.resultExtensions.map((ext) => `${stem}.${ext}`);
  }

  function findExistingImage(paths, index = 0) {
    return new Promise((resolve, reject) => {
      if (index >= paths.length) {
        reject(new Error("No matching image found."));
        return;
      }
      const probe = new Image();
      probe.onload = () => resolve(paths[index]);
      probe.onerror = () => findExistingImage(paths, index + 1).then(resolve).catch(reject);
      probe.src = paths[index];
    });
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(src);
      image.onerror = reject;
      image.src = src;
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setProgress(value) {
    const pct = Math.max(0, Math.min(100, value));
    progressBar.style.width = `${pct}%`;
    progressLabel.textContent = `${Math.round(pct)}%`;
  }

  function runFakeProgress(ms, token) {
    setProgress(0);
    const started = performance.now();

    return new Promise((resolve) => {
      function tick(now) {
        if (token !== generationToken) {
          resolve();
          return;
        }

        const elapsed = now - started;
        const ratio = Math.min(elapsed / ms, 1);
        const eased = 100 * (1 - Math.pow(1 - ratio, 1.6));
        const displayValue = ratio < 1 ? Math.min(eased, 96) : 100;
        setProgress(displayValue);

        if (ratio >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  async function generate() {
    if (!selectedContent || !selectedStyle) return;

    generationToken += 1;
    const token = generationToken;

    generateBtn.disabled = true;
    generateBtn.dataset.originalText = generateBtn.textContent;
    generateBtn.textContent = "Generating…";
    clearBtn.disabled = true;
    loadingTitle.textContent = "Generating result…";
    loadingSubtitle.textContent = `${selectedContent.label} × ${selectedStyle.label}`;
    loadingOverlay.classList.remove("hidden");

    try {
      const [path] = await Promise.all([
        (async () => {
          const found = await findExistingImage(candidatePaths(selectedContent.id, selectedStyle.id));
          await preloadImage(found);
          return found;
        })(),
        runFakeProgress(config.fakeLoadingMs || 1000, token)
      ]);

      if (token !== generationToken) return;

      setProgress(100);
      await wait(80);

      resultImage.src = path;
      resultPlaceholder.classList.add("hidden");
      resultView.classList.remove("hidden");
    } catch (error) {
      if (token !== generationToken) return;
      resultView.classList.add("hidden");
      resultPlaceholder.classList.remove("hidden");
      statusTitle.textContent = "Result not found";
      statusDetail.textContent = `ortho_${selectedContent.id}_${selectedStyle.id}.[png/jpg/webp/svg] is missing.`;
    } finally {
      if (token !== generationToken) return;
      await wait(120);
      loadingOverlay.classList.add("hidden");
      generateBtn.textContent = generateBtn.dataset.originalText || "✨ Generate";
      generateBtn.disabled = !(selectedContent && selectedStyle);
      clearBtn.disabled = false;
    }
  }

  function clearAll() {
    generationToken += 1;
    selectedContent = null;
    selectedStyle = null;
    document.querySelectorAll(".thumb-card.selected").forEach((el) => el.classList.remove("selected"));
    generateBtn.disabled = true;
    clearBtn.disabled = false;
    loadingOverlay.classList.add("hidden");
    setProgress(0);
    resultView.classList.add("hidden");
    resultPlaceholder.classList.remove("hidden");
    statusTitle.textContent = "Choose a content and a style";
    statusDetail.textContent = "The corresponding precomputed output will appear here.";
  }

  renderGrid(config.content, contentGrid, "content");
  renderGrid(config.style, styleGrid, "style");
  generateBtn.addEventListener("click", generate);
  clearBtn.addEventListener("click", clearAll);
})();
