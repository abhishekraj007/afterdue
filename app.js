(function () {
  "use strict";

  var STORE_KEY = "afterdue.invoice.v1";

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
  var skipSave = false;

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
    return {
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
    };
  }

  function persist() {
    if (skipSave) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(snapshot()));
      if (saveHint) saveHint.textContent = "Draft saved in this browser. Nothing is uploaded.";
    } catch (err) {
      if (saveHint) saveHint.textContent = "This browser would not save a draft. Print before you close the tab.";
    }
  }

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function applyState(state) {
    if (!state) return;
    skipSave = true;
    Object.keys(SAMPLE).forEach(function (key) {
      if (key === "items" || key === "depositMode") return;
      if (form.elements[key] && state[key] != null) {
        form.elements[key].value = state[key];
      }
    });
    if (form.elements.depositMode) {
      form.elements.depositMode.checked = !!state.depositMode;
    }
    itemsWrap.replaceChildren();
    var items = Array.isArray(state.items) && state.items.length ? state.items : [{ desc: "", qty: "1", rate: "" }];
    items.forEach(addItem);
    skipSave = false;
    render();
  }

  function render() {
    var items = readItems();
    var subtotal = items.reduce(function (sum, item) {
      return sum + item.amount;
    }, 0);
    var taxRate = parseFloat(field("taxRate")) || 0;
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
    if (saveHint) saveHint.textContent = "Sample restored. Edit it — the draft stays in this browser.";
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
    if (saveHint) saveHint.textContent = "Blank invoice. Due date set to Net 15 from today.";
    var first = form.querySelector('[name="fromName"]');
    if (first) first.focus();
  }

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

  var saved = loadSaved();
  if (saved && (saved.fromName || saved.clientName || (saved.items && saved.items.some(function (item) { return item.desc || item.rate; })))) {
    applyState(saved);
    if (saveHint) saveHint.textContent = "Your last draft was restored. It never left this browser.";
  } else {
    fillSample();
  }
})();
