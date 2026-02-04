(() => {
  const API_BASE = "https://api.escuelajs.co/api/v1";
  const PRODUCTS_URL = `${API_BASE}/products`;
  const CATEGORIES_URL = `${API_BASE}/categories`;

  // DOM
  const tbody = document.getElementById("tbody");
  const statusText = document.getElementById("statusText");
  const countBadge = document.getElementById("countBadge");
  const pageText = document.getElementById("pageText");

  const searchInput = document.getElementById("searchInput");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnExportCsv = document.getElementById("btnExportCsv");
  const btnOpenCreate = document.getElementById("btnOpenCreate");

  const sortTitleBtn = document.getElementById("sortTitleBtn");
  const sortPriceBtn = document.getElementById("sortPriceBtn");
  const sortTitleIndicator = document.getElementById("sortTitleIndicator");
  const sortPriceIndicator = document.getElementById("sortPriceIndicator");

  const alertBox = document.getElementById("alertBox");

  // Detail modal
  const detailModalEl = document.getElementById("detailModal");
  const detailModal = new bootstrap.Modal(detailModalEl);

  const detailTitle = document.getElementById("detailTitle");
  const detailSub = document.getElementById("detailSub");
  const detailDesc = document.getElementById("detailDesc");
  const detailImages = document.getElementById("detailImages");

  const detailView = document.getElementById("detailView");
  const detailEdit = document.getElementById("detailEdit");
  const detailLoading = document.getElementById("detailLoading");

  const btnToggleEdit = document.getElementById("btnToggleEdit");
  const btnSaveEdit = document.getElementById("btnSaveEdit");

  const editTitle = document.getElementById("editTitle");
  const editPrice = document.getElementById("editPrice");
  const editDesc = document.getElementById("editDesc");
  const editCategoryId = document.getElementById("editCategoryId");
  const editImages = document.getElementById("editImages");

  // Create modal
  const createModalEl = document.getElementById("createModal");
  const createModal = new bootstrap.Modal(createModalEl);

  const createTitle = document.getElementById("createTitle");
  const createPrice = document.getElementById("createPrice");
  const createDesc = document.getElementById("createDesc");
  const createCategoryId = document.getElementById("createCategoryId");
  const createImages = document.getElementById("createImages");
  const createLoading = document.getElementById("createLoading");
  const btnCreate = document.getElementById("btnCreate");

  // State
  const state = {
    page: 1,
    pageSize: Number(pageSizeSelect.value),
    search: "",
    sortField: null,     // 'title' | 'price' | null
    sortDir: "asc",      // 'asc' | 'desc'
    items: [],
    categories: [],
    selected: null,
    tooltips: []
  };

  // ---------- Utils ----------
  function showAlert(type, message) {
    // type: 'success' | 'danger' | 'warning' | 'info'
    alertBox.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        <div>${escapeHtml(message)}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  function clearAlert() {
    alertBox.innerHTML = "";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeImg(url) {
    const u = String(url || "").trim();
    if (!u) return "https://placehold.co/88x88?text=No+Image";
    return u;
  }

  function setLoading(isLoading) {
    statusText.textContent = isLoading ? "Đang tải dữ liệu..." : "Sẵn sàng";
  }

  function destroyTooltips() {
    state.tooltips.forEach(t => {
      try { t.dispose(); } catch (_) {}
    });
    state.tooltips = [];
  }

  function parseImagesTextarea(text) {
    return String(text || "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    // Escape quotes by double quotes
    const escaped = s.replaceAll('"', '""');
    // Wrap in quotes if contains comma/newline/quote
    if (/[",\n]/.test(escaped)) return `"${escaped}"`;
    return escaped;
  }

  function getSortIndicator(field) {
    if (state.sortField !== field) return "";
    return state.sortDir === "asc" ? "▲" : "▼";
  }

  // ---------- API ----------
  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    // API thường trả JSON, nếu lỗi vẫn parse để lấy message
    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadCategories() {
    try {
      const cats = await fetchJson(CATEGORIES_URL);
      state.categories = Array.isArray(cats) ? cats : [];
      fillCategorySelects();
    } catch (e) {
      showAlert("warning", "Không tải được categories. Bạn vẫn có thể nhập categoryId thủ công, nhưng dropdown có thể trống.");
      state.categories = [];
      fillCategorySelects();
    }
  }

  function fillCategorySelects() {
    const options = state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (#${c.id})</option>`).join("");
    // Nếu rỗng, vẫn để option mặc định
    const fallback = `<option value="1">Clothes (#1)</option>`;

    editCategoryId.innerHTML = options || fallback;
    createCategoryId.innerHTML = options || fallback;
  }

  async function loadProducts() {
    clearAlert();
    setLoading(true);

    const offset = (state.page - 1) * state.pageSize;
    const limit = state.pageSize;

    try {
      const url = `${PRODUCTS_URL}?offset=${offset}&limit=${limit}`;
      const data = await fetchJson(url);
      state.items = Array.isArray(data) ? data : [];
      render();
      setLoading(false);
    } catch (e) {
      setLoading(false);
      showAlert("danger", `Lỗi tải products: ${e.message}`);
      state.items = [];
      render();
    }
  }

  // ---------- View transformations ----------
  function getCurrentViewItems() {
    // Filter by title (onChanged)
    let items = [...state.items];

    const q = state.search.trim().toLowerCase();
    if (q) {
      items = items.filter(p => String(p.title || "").toLowerCase().includes(q));
    }

    // Sort (title/price)
    if (state.sortField) {
      const field = state.sortField;
      const dir = state.sortDir === "asc" ? 1 : -1;

      items.sort((a, b) => {
        if (field === "price") {
          const pa = Number(a.price ?? 0);
          const pb = Number(b.price ?? 0);
          return (pa - pb) * dir;
        }
        if (field === "title") {
          const ta = String(a.title || "").toLowerCase();
          const tb = String(b.title || "").toLowerCase();
          if (ta < tb) return -1 * dir;
          if (ta > tb) return 1 * dir;
          return 0;
        }
        return 0;
      });
    }

    return items;
  }

  // ---------- Render ----------
  function render() {
    destroyTooltips();

    const viewItems = getCurrentViewItems();

    countBadge.textContent = viewItems.length;
    pageText.textContent = `Trang ${state.page} • Hiển thị ${state.pageSize}/trang`;

    // Enable/disable prev
    btnPrev.disabled = state.page <= 1;

    // Next: chỉ cho next khi API trả đủ pageSize (khả năng còn dữ liệu)
    // Nếu bạn filter search làm ít item lại, vẫn cho next theo logic API gốc:
    btnNext.disabled = state.items.length < state.pageSize;

    sortTitleIndicator.textContent = getSortIndicator("title");
    sortPriceIndicator.textContent = getSortIndicator("price");

    if (!viewItems.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            Không có dữ liệu trong trang này (hoặc do filter).
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = viewItems.map(item => {
      const imgList = Array.isArray(item.images) ? item.images : [];
      const firstImg = safeImg(imgList[0]);
      const moreCount = Math.max(0, imgList.length - 1);

      const catName = item.category?.name ? item.category.name : "(no category)";
      const desc = String(item.description || "");

      return `
        <tr class="row-clickable"
            data-id="${item.id}"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            data-bs-title="${escapeHtml(desc)}"
        >
          <td class="fw-semibold">#${item.id}</td>

          <td>
            <span class="truncate-1">${escapeHtml(item.title)}</span>
            <div class="small text-muted">slug: ${escapeHtml(item.slug || "")}</div>
          </td>

          <td class="fw-semibold">$${Number(item.price ?? 0).toLocaleString()}</td>

          <td>
            <span class="badge text-bg-light border">${escapeHtml(catName)}</span>
            <div class="small text-muted">id: ${escapeHtml(item.category?.id ?? "")}</div>
          </td>

          <td>
            <div class="d-flex align-items-center gap-2">
              <img class="img-thumb" src="${escapeHtml(firstImg)}" alt="img" onerror="this.src='https://placehold.co/88x88?text=No+Image'">
              ${moreCount ? `<span class="badge text-bg-secondary">+${moreCount}</span>` : ``}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // init tooltips for description hover
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      state.tooltips.push(new bootstrap.Tooltip(el));
    });

    // bind row click open detail
    document.querySelectorAll("tr.row-clickable").forEach(tr => {
      tr.addEventListener("click", () => {
        const id = Number(tr.getAttribute("data-id"));
        const found = viewItems.find(x => Number(x.id) === id);
        if (found) openDetail(found);
      });
    });
  }

  // ---------- Detail Modal ----------
  function setDetailLoading(isLoading) {
    detailLoading.classList.toggle("d-none", !isLoading);
    detailView.classList.toggle("d-none", isLoading);
    detailEdit.classList.toggle("d-none", true); // hide edit while loading
    btnSaveEdit.classList.add("d-none");
    btnToggleEdit.disabled = isLoading;
  }

  function openDetail(item) {
    state.selected = item;

    // Fill view
    detailTitle.textContent = item.title || "Product Detail";
    detailSub.textContent = `#${item.id} • Price: $${Number(item.price ?? 0).toLocaleString()} • Category: ${item.category?.name || ""}`;

    detailDesc.textContent = item.description || "";

    const imgs = Array.isArray(item.images) ? item.images : [];
    detailImages.innerHTML = imgs.length
      ? imgs.map(u => `<img class="img-thumb" src="${escapeHtml(safeImg(u))}" alt="img" onerror="this.src='https://placehold.co/88x88?text=No+Image'">`).join("")
      : `<span class="text-muted">No images</span>`;

    // Prepare edit fields
    editTitle.value = item.title || "";
    editPrice.value = Number(item.price ?? 0);
    editDesc.value = item.description || "";
    // categoryId
    const catId = item.category?.id ?? 1;
    editCategoryId.value = String(catId);
    // images textarea
    editImages.value = (imgs || []).join("\n");

    // Reset mode
    detailView.classList.remove("d-none");
    detailEdit.classList.add("d-none");
    btnSaveEdit.classList.add("d-none");
    btnToggleEdit.textContent = "Edit";

    detailModal.show();
  }

  function toggleEditMode() {
    const isEditing = !detailEdit.classList.contains("d-none");
    if (isEditing) {
      // back to view
      detailEdit.classList.add("d-none");
      detailView.classList.remove("d-none");
      btnSaveEdit.classList.add("d-none");
      btnToggleEdit.textContent = "Edit";
    } else {
      // to edit
      detailView.classList.add("d-none");
      detailEdit.classList.remove("d-none");
      btnSaveEdit.classList.remove("d-none");
      btnToggleEdit.textContent = "Cancel";
    }
  }

  async function saveEdit() {
    if (!state.selected) return;

    const id = state.selected.id;

    const title = editTitle.value.trim();
    const price = Number(editPrice.value);
    const description = editDesc.value.trim();
    const categoryId = Number(editCategoryId.value);
    const images = parseImagesTextarea(editImages.value);

    if (!title) return showAlert("warning", "Title không được trống.");
    if (!Number.isFinite(price) || price < 0) return showAlert("warning", "Price không hợp lệ.");
    if (!description) return showAlert("warning", "Description không được trống.");
    if (!Number.isFinite(categoryId) || categoryId <= 0) return showAlert("warning", "CategoryId không hợp lệ.");
    if (!images.length) return showAlert("warning", "Images phải có ít nhất 1 URL.");

    setDetailLoading(true);

    try {
      const body = {
        title,
        price,
        description,
        categoryId,
        images
      };

      const updated = await fetchJson(`${PRODUCTS_URL}/${id}`, {
        method: "PUT",
        body: JSON.stringify(body)
      });

      showAlert("success", `Update thành công: #${updated.id} (${updated.title})`);
      detailModal.hide();

      // reload current page
      await loadProducts();
    } catch (e) {
      showAlert("danger", `Update thất bại: ${e.message}`);
      setDetailLoading(false);
      // show edit again
      detailLoading.classList.add("d-none");
      detailEdit.classList.remove("d-none");
      btnSaveEdit.classList.remove("d-none");
      btnToggleEdit.disabled = false;
    }
  }

  // ---------- Create Modal ----------
  function openCreateModal() {
    // reset form
    createTitle.value = "";
    createPrice.value = "";
    createDesc.value = "";
    createImages.value = "https://placehold.co/600x400";
    // pick first category
    if (createCategoryId.options.length) createCategoryId.selectedIndex = 0;

    createLoading.classList.add("d-none");
    btnCreate.disabled = false;

    createModal.show();
  }

  async function createProduct() {
    const title = createTitle.value.trim();
    const price = Number(createPrice.value);
    const description = createDesc.value.trim();
    const categoryId = Number(createCategoryId.value);
    const images = parseImagesTextarea(createImages.value);

    if (!title) return showAlert("warning", "Title không được trống.");
    if (!Number.isFinite(price) || price < 0) return showAlert("warning", "Price không hợp lệ.");
    if (!description) return showAlert("warning", "Description không được trống.");
    if (!Number.isFinite(categoryId) || categoryId <= 0) return showAlert("warning", "CategoryId không hợp lệ.");
    if (!images.length) return showAlert("warning", "Images phải có ít nhất 1 URL.");

    createLoading.classList.remove("d-none");
    btnCreate.disabled = true;

    try {
      const body = { title, price, description, categoryId, images };
      const created = await fetchJson(`${PRODUCTS_URL}/`, {
        method: "POST",
        body: JSON.stringify(body)
      });

      showAlert("success", `Tạo thành công: #${created.id} (${created.title})`);
      createModal.hide();

      // Sau khi tạo: về trang 1 load lại để dễ thấy
      state.page = 1;
      await loadProducts();
    } catch (e) {
      showAlert("danger", `Tạo thất bại: ${e.message}`);
      createLoading.classList.add("d-none");
      btnCreate.disabled = false;
    }
  }

  // ---------- Export CSV ----------
  function exportCsv() {
    const viewItems = getCurrentViewItems();

    const header = ["id", "title", "price", "category", "images"];
    const rows = viewItems.map(p => {
      const images = Array.isArray(p.images) ? p.images.join("|") : "";
      const category = p.category?.name || "";
      return [
        p.id,
        p.title ?? "",
        p.price ?? "",
        category,
        images
      ].map(csvEscape).join(",");
    });

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `products_page${state.page}_size${state.pageSize}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  // ---------- Events ----------
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    render(); // search chỉ filter view hiện tại (đúng yêu cầu onChanged)
  });

  pageSizeSelect.addEventListener("change", async () => {
    state.pageSize = Number(pageSizeSelect.value);
    state.page = 1;
    await loadProducts();
  });

  btnPrev.addEventListener("click", async () => {
    if (state.page > 1) {
      state.page--;
      await loadProducts();
    }
  });

  btnNext.addEventListener("click", async () => {
    state.page++;
    await loadProducts();
  });

  sortTitleBtn.addEventListener("click", () => {
    if (state.sortField === "title") {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.sortField = "title";
      state.sortDir = "asc";
    }
    render();
  });

  sortPriceBtn.addEventListener("click", () => {
    if (state.sortField === "price") {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.sortField = "price";
      state.sortDir = "asc";
    }
    render();
  });

  btnExportCsv.addEventListener("click", exportCsv);
  btnOpenCreate.addEventListener("click", openCreateModal);

  btnToggleEdit.addEventListener("click", toggleEditMode);
  btnSaveEdit.addEventListener("click", saveEdit);

  btnCreate.addEventListener("click", createProduct);

  // ---------- Init ----------
  async function init() {
    await loadCategories();
    await loadProducts();
    setLoading(false);
    statusText.textContent = "Sẵn sàng";
  }

  init();
})();
