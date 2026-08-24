(function () {
  "use strict";

  var STORE_KEY = "afterdue.invoice.v1";
  var SAVE_KEY = "afterdue.saveDraft.v1";
  var MAX_ITEMS = 40;
  var LIMITS = {
    fromName: 120,
    fromEmail: 120,
    fromCity: 80,
    clientName: 120,
    clientEmail: 120,
    clientCity: 80,
    invoiceNumber: 40,
    issueDate: 10,
    dueDate: 10,
    taxRate: 8,
    notes: 2000,
    payment: 2000
  };

  var SAMPLE = {
    fromName: "Maya Chen Studio",
    fromEmail: "maya@mayachen.studio",
    fromCity: "Austin, TX",
    clientName: "Honey & Rye Bakery",
    clientEmail: "hello@honeyandrye.co",
    clientCity: "Brooklyn, NY",
    invoiceNumber: "1042",
    issueDate: "2026-08-10",
    dueDate: "2026-08-25",
    taxRate: "8.25",
    notes: "Net 15 from issue date. Scope as agreed in the July 28 brief — one revision round on the mark, two on the menu plates.",
    payment: "Zelle: maya@mayachen.studio\nACH: Chase · Maya Chen Studio · Routing provided on request\nVenmo: @mayachen-studio\nPlease include invoice 1042 in the memo.",
    depositMode: false,
    items: [
      { desc: "Brand identity refresh — wordmark, palette, type", qty: "1", rate: "2400" },
      { desc: "Seasonal menu illustrations (6 plates)", qty: "6", rate: "185" },
      { desc: "Print-ready bakery card set", qty: "1", rate: "450" }
    ]
  };

  var form = document.getElementById("invoice-form");
  var itemsWrap = document.getElementById("line-items");
  var addBtn = document.getElementById("add-item");
  var printBtn = document.getElementById("print-btn");
  var resetBtn = document.getElementById("reset-btn");
  var blankBtn = document.getElementById("blank-btn");
  var saveHint = document.getElementById("save-hint");
  var saveBox = document.getElementById("save-draft");
  var clearBtn = document.getElementById("clear-draft");
  var banner = document.getElementById("draft-banner");
  var restoreBtn = document.getElementById("restore-draft");
  var discardBtn = document.getElementById("discard-draft");
  var skipSave = false;
  var pendingDraft = null;

  if (!form || !itemsWrap) return;

  var money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  var dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toISO(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function addDaysISO(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + days);
    return toISO(d);
  }

  function clip(value, max) {
    return String(value == null ? "" : value).replace(/\0/g, "").slice(0, max);
  }

  function isoDate(value) {
    var text = clip(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var out = {};
    Object.keys(LIMITS).forEach(function (key) {
      if (key === "issueDate" || key === "dueDate") {
        out[key] = isoDate(raw[key]);
      } else {
        out[key] = clip(raw[key], LIMITS[key]);
      }
    });
    out.depositMode = raw.depositMode === true;
    out.items = [];
    if (Array.isArray(raw.items)) {
      raw.items.slice(0, MAX_ITEMS).forEach(function (item) {
        if (!item || typeof item !== "object") return;
        out.items.push({
          desc: clip(item.desc, 140),
          qty: clip(item.qty, 12),
          rate: clip(item.rate, 16)
        });
      });
    }
    if (!out.items.length) out.items.push({ desc: "", qty: "1", rate: "" });
    return out;
  }

  function looksLikeDraft(state) {
    if (!state) return false;
    if (state.fromName || state.clientName || state.payment || state.notes) return true;
    return state.items.some(function (item) {
      return item.desc || item.rate;
    });
  }

  function savingEnabled() {
    return !!(saveBox && saveBox.checked);
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "class") node.className = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function addItem(item) {
    if (itemsWrap.children.length >= MAX_ITEMS) return;

    var row = el("div", { class: "line-item" });

    var dLab = el("label", { class: "item-desc" }, "Description");
    var dIn = el("input", {
      type: "text",
      name: "itemDesc",
      required: "true",
      maxlength: "140"
    });
    dIn.value = item && item.desc ? item.desc : "";
    dLab.appendChild(dIn);

    var qLab = el("label", null, "Qty");
    var qIn = el("input", {
      type: "number",
      name: "itemQty",
      min: "0",
      step: "0.01",
      inputmode: "decimal"
    });
    qIn.value = item && item.qty != null ? item.qty : "1";
    qLab.appendChild(qIn);

    var rLab = el("label", null, "Rate");
    var rIn = el("input", {
      type: "number",
      name: "itemRate",
      min: "0",
      step: "0.01",
      inputmode: "decimal"
    });
    rIn.value = item && item.rate != null ? item.rate : "";
    rLab.appendChild(rIn);

    var rm = el("button", {
      type: "button",
      class: "item-remove",
      "aria-label": "Remove line"
    }, "×");
    rm.addEventListener("click", function () {
      if (itemsWrap.children.length === 1) {
        dIn.value = "";
        qIn.value = "1";
        rIn.value = "";
        render();
        persist();
        return;
      }
      row.remove();
      render();
      persist();
    });

    row.appendChild(dLab);
    row.appendChild(qLab);
    row.appendChild(rLab);
    row.appendChild(rm);
    itemsWrap.appendChild(row);
  }

  function readItems() {
    return Array.prototype.map.call(itemsWrap.querySelectorAll(".line-item"), function (row) {
      var desc = row.querySelector('[name="itemDesc"]').value.trim();
      var qty = parseFloat(row.querySelector('[name="itemQty"]').value) || 0;
      var rate = parseFloat(row.querySelector('[name="itemRate"]').value) || 0;
      return { desc: desc, qty: qty, rate: rate, amount: qty * rate };
    });
  }

  function field(name) {
    var node = form.elements[name];
    return node ? String(node.value || "").trim() : "";
  }

  function checked(name) {
    var node = form.elements[name];
    return !!(node && node.checked);
  }

  function formatDate(value) {
    if (!value) return "—";
    var parts = value.split("-");
    if (parts.length !== 3) return value;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return value;
    return dateFmt.format(d);
  }

  function joinMeta(email, city) {
    return [email, city].filter(Boolean).join("\n");
  }

  function snapshot() {
    return sanitizeState({
      fromName: field("fromName"),
      fromEmail: field("fromEmail"),
      fromCity: field("fromCity"),
      clientName: field("clientName"),
      clientEmail: field("clientEmail"),
      clientCity: field("clientCity"),
      invoiceNumber: field("invoiceNumber"),
      issueDate: field("issueDate"),
      dueDate: field("dueDate"),
      taxRate: field("taxRate"),
      notes: field("notes"),
      payment: field("payment"),
      depositMode: checked("depositMode"),
      items: readItems().map(function (item) {
        return {
          desc: item.desc,
          qty: String(item.qty || ""),
          rate: String(item.rate || "")
        };
      })
    });
  }

  function setHint(text) {
    if (saveHint) saveHint.textContent = text;
  }

  function persist() {
    if (skipSave || !savingEnabled() || pendingDraft) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(snapshot()));
      window.localStorage.setItem(SAVE_KEY, "1");
      setHint("Draft saved on this device only. Nothing is uploaded. Uncheck to stop.");
    } catch (err) {
      setHint("This browser would not save a draft. Print before you close the tab.");
    }
  }

  function clearStore() {
    try {
      window.localStorage.removeItem(STORE_KEY);
      window.localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      /* ignore quota / private-mode failures */
    }
    pendingDraft = null;
    showBanner(false);
  }

  function forgetDraft() {
    skipSave = true;
    if (saveBox) saveBox.checked = false;
    clearStore();
    skipSave = false;
  }

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw || raw.length > 20000) return null;
      return sanitizeState(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  function optedIn() {
    try {
      return window.localStorage.getItem(SAVE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function applyState(state) {
    if (!state) return;
    skipSave = true;
    Object.keys(LIMITS).forEach(function (key) {
      if (form.elements[key] && state[key] != null) {
        form.elements[key].value = state[key];
      }
    });
    if (form.elements.depositMode) {
      form.elements.depositMode.checked = !!state.depositMode;
    }
    itemsWrap.replaceChildren();
    var items = Array.isArray(state.items) && state.items.length ? state.items : [{ desc: "", qty: "1", rate: "" }];
    items.slice(0, MAX_ITEMS).forEach(addItem);
    skipSave = false;
    render();
  }

  function render() {
    var items = readItems();
    var subtotal = items.reduce(function (sum, item) {
      return sum + item.amount;
    }, 0);
    var taxRate = parseFloat(field("taxRate")) || 0;
    if (taxRate < 0) taxRate = 0;
    if (taxRate > 30) taxRate = 30;
    var tax = subtotal * (taxRate / 100);
    var total = subtotal + tax;
    var deposit = checked("depositMode");
    var depositAmt = Math.round(total * 50) / 100;
    var due = deposit ? depositAmt : total;

    document.getElementById("pv-fromName").textContent = field("fromName") || "Your studio";
    document.getElementById("pv-fromMeta").textContent = joinMeta(field("fromEmail"), field("fromCity"));
    document.getElementById("pv-clientName").textContent = field("clientName") || "Client";
    document.getElementById("pv-clientMeta").textContent = joinMeta(field("clientEmail"), field("clientCity"));
    document.getElementById("pv-number").textContent = field("invoiceNumber") ? "#" + field("invoiceNumber") : "#—";
    document.getElementById("pv-issue").textContent = formatDate(field("issueDate"));
    document.getElementById("pv-due").textContent = formatDate(field("dueDate"));
    document.getElementById("pv-notes").textContent = field("notes") || "—";
    document.getElementById("pv-payment").textContent = field("payment") || "—";

    var stamp = document.getElementById("pv-stamp");
    if (stamp) stamp.textContent = deposit ? "DEPOSIT" : "INVOICE";

    var tbody = document.getElementById("pv-items");
    tbody.replaceChildren();
    if (!items.length || items.every(function (item) { return !item.desc && !item.amount; })) {
      var empty = el("tr");
      var td = el("td", { colspan: "4" }, "Add a line item.");
      td.style.color = "#6d665a";
      empty.appendChild(td);
      tbody.appendChild(empty);
    } else {
      items.forEach(function (item) {
        if (!item.desc && !item.amount) return;
        var tr = el("tr");
        tr.appendChild(el("td", null, item.desc || "—"));
        tr.appendChild(el("td", { class: "num" }, String(item.qty)));
        tr.appendChild(el("td", { class: "num" }, money.format(item.rate)));
        tr.appendChild(el("td", { class: "num" }, money.format(item.amount)));
        tbody.appendChild(tr);
      });
    }

    document.getElementById("pv-subtotal").textContent = money.format(subtotal);
    document.getElementById("pv-tax-label").textContent = taxRate ? "Tax (" + taxRate + "%)" : "Tax";
    document.getElementById("pv-tax").textContent = money.format(tax);

    var depositRow = document.getElementById("pv-deposit-row");
    var grandLabel = document.getElementById("pv-grand-label");
    if (depositRow) depositRow.hidden = !deposit;
    if (deposit) {
      document.getElementById("pv-deposit").textContent = money.format(total);
      if (grandLabel) grandLabel.textContent = "Deposit due (50%)";
      document.getElementById("pv-grand").textContent = money.format(depositAmt);
    } else {
      if (grandLabel) grandLabel.textContent = "Total due";
      document.getElementById("pv-grand").textContent = money.format(total);
    }

    document.getElementById("preview-total").textContent = money.format(due) + (deposit ? " deposit" : " due");
    document.title = (field("invoiceNumber") ? "Invoice " + field("invoiceNumber") + " — " : "") + "Afterdue";
  }

  function fillSample() {
    applyState(SAMPLE);
    persist();
    setHint(savingEnabled()
      ? "Sample restored. This draft is saved on this device only."
      : "Sample restored. Check “Keep a draft” if you want this browser to remember your invoice.");
  }

  function startBlank() {
    var issue = toISO(new Date());
    applyState({
      fromName: "",
      fromEmail: "",
      fromCity: "",
      clientName: "",
      clientEmail: "",
      clientCity: "",
      invoiceNumber: "",
      issueDate: issue,
      dueDate: addDaysISO(issue, 15),
      taxRate: "",
      notes: "",
      payment: "",
      depositMode: false,
      items: [{ desc: "", qty: "1", rate: "" }]
    });
    persist();
    setHint("Blank invoice. Due date set to Net 15 from today.");
    var first = form.querySelector('[name="fromName"]');
    if (first) first.focus();
  }

  function showBanner(show) {
    if (!banner) return;
    banner.hidden = !show;
    document.body.classList.toggle("has-draft-banner", !!show);
    if (!show) return;
    var header = document.querySelector(".site-header");
    if (header && banner.parentNode !== document.body) {
      header.insertAdjacentElement("afterend", banner);
    }
  }

  form.setAttribute("action", "");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });
  form.addEventListener("input", function () {
    render();
    persist();
  });
  form.addEventListener("change", function () {
    render();
    persist();
  });
  addBtn.addEventListener("click", function () {
    addItem({ desc: "", qty: "1", rate: "" });
    var last = itemsWrap.querySelector(".line-item:last-child input");
    if (last) last.focus();
    render();
    persist();
  });
  if (resetBtn) resetBtn.addEventListener("click", fillSample);
  if (blankBtn) blankBtn.addEventListener("click", startBlank);
  printBtn.addEventListener("click", function () {
    persist();
    window.print();
  });

  if (saveBox) {
    saveBox.addEventListener("change", function () {
      if (savingEnabled()) {
        persist();
      } else {
        forgetDraft();
        setHint("Draft deleted from this browser. Nothing was uploaded.");
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      forgetDraft();
      startBlank();
      setHint("Draft deleted from this browser.");
    });
  }

  if (restoreBtn) {
    restoreBtn.addEventListener("click", function () {
      if (!pendingDraft) return;
      applyState(pendingDraft);
      pendingDraft = null;
      showBanner(false);
      if (savingEnabled()) persist();
      setHint("Draft restored. It never left this browser.");
    });
  }

  if (discardBtn) {
    discardBtn.addEventListener("click", function () {
      forgetDraft();
      setHint("Saved draft deleted. This page is showing the sample.");
    });
  }

  var saved = loadSaved();
  var wasOptedIn = optedIn();
  if (saveBox) saveBox.checked = false;
  fillSample();
  if (saved && looksLikeDraft(saved)) {
    pendingDraft = saved;
    if (window.history && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    showBanner(true);
    if (saveBox) saveBox.checked = wasOptedIn;
    setHint("A draft is waiting. Restore it only on your own device.");
  }
})();
