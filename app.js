(function () {
  "use strict";

  const SAMPLE = {
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
    items: [
      { desc: "Brand identity refresh — wordmark, palette, type", qty: "1", rate: "2400" },
      { desc: "Seasonal menu illustrations (6 plates)", qty: "6", rate: "185" },
      { desc: "Print-ready bakery card set", qty: "1", rate: "450" }
    ]
  };

  const form = document.getElementById("invoice-form");
  const itemsWrap = document.getElementById("line-items");
  const addBtn = document.getElementById("add-item");
  const printBtn = document.getElementById("print-btn");
  const resetBtn = document.getElementById("reset-btn");

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(function (entry) {
        if (entry[0] === "class") node.className = entry[1];
        else node.setAttribute(entry[0], entry[1]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function addItem(item) {
    const row = el("div", { class: "line-item" });

    const dLab = el("label", { class: "item-desc" }, "Description");
    const dIn = el("input", {
      type: "text",
      name: "itemDesc",
      required: "true",
      maxlength: "140"
    });
    dIn.value = item && item.desc ? item.desc : "";
    dLab.appendChild(dIn);

    const qLab = el("label", null, "Qty");
    const qIn = el("input", {
      type: "number",
      name: "itemQty",
      min: "0",
      step: "0.01",
      inputmode: "decimal"
    });
    qIn.value = item && item.qty != null ? item.qty : "1";
    qLab.appendChild(qIn);

    const rLab = el("label", null, "Rate");
    const rIn = el("input", {
      type: "number",
      name: "itemRate",
      min: "0",
      step: "0.01",
      inputmode: "decimal"
    });
    rIn.value = item && item.rate != null ? item.rate : "";
    rLab.appendChild(rIn);

    const rm = el("button", {
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
        return;
      }
      row.remove();
      render();
    });

    row.appendChild(dLab);
    row.appendChild(qLab);
    row.appendChild(rLab);
    row.appendChild(rm);
    itemsWrap.appendChild(row);
  }

  function readItems() {
    return Array.prototype.map.call(itemsWrap.querySelectorAll(".line-item"), function (row) {
      const desc = row.querySelector('[name="itemDesc"]').value.trim();
      const qty = parseFloat(row.querySelector('[name="itemQty"]').value) || 0;
      const rate = parseFloat(row.querySelector('[name="itemRate"]').value) || 0;
      return { desc: desc, qty: qty, rate: rate, amount: qty * rate };
    });
  }

  function field(name) {
    const node = form.elements[name];
    return node ? String(node.value || "").trim() : "";
  }

  function formatDate(value) {
    if (!value) return "—";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return value;
    return dateFmt.format(d);
  }

  function joinMeta(email, city) {
    return [email, city].filter(Boolean).join("\n");
  }

  function render() {
    const items = readItems();
    const subtotal = items.reduce(function (sum, item) {
      return sum + item.amount;
    }, 0);
    const taxRate = parseFloat(field("taxRate")) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    document.getElementById("pv-fromName").textContent = field("fromName") || "Your studio";
    document.getElementById("pv-fromMeta").textContent = joinMeta(field("fromEmail"), field("fromCity"));
    document.getElementById("pv-clientName").textContent = field("clientName") || "Client";
    document.getElementById("pv-clientMeta").textContent = joinMeta(field("clientEmail"), field("clientCity"));
    document.getElementById("pv-number").textContent = field("invoiceNumber") ? "#" + field("invoiceNumber") : "#—";
    document.getElementById("pv-issue").textContent = formatDate(field("issueDate"));
    document.getElementById("pv-due").textContent = formatDate(field("dueDate"));
    document.getElementById("pv-notes").textContent = field("notes") || "—";
    document.getElementById("pv-payment").textContent = field("payment") || "—";

    const tbody = document.getElementById("pv-items");
    tbody.replaceChildren();
    if (!items.length || items.every(function (item) { return !item.desc && !item.amount; })) {
      const tr = el("tr");
      const td = el("td", { colspan: "4" }, "Add a line item.");
      td.style.color = "#6d665a";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      items.forEach(function (item) {
        if (!item.desc && !item.amount) return;
        const tr = el("tr");
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
    document.getElementById("pv-grand").textContent = money.format(total);
    document.getElementById("preview-total").textContent = money.format(total) + " due";
    document.title = (field("invoiceNumber") ? "Invoice " + field("invoiceNumber") + " — " : "") + "Afterdue";
  }

  function fillSample() {
    Object.keys(SAMPLE).forEach(function (key) {
      if (key === "items") return;
      if (form.elements[key]) form.elements[key].value = SAMPLE[key];
    });
    itemsWrap.replaceChildren();
    SAMPLE.items.forEach(addItem);
    render();
  }

  form.addEventListener("input", render);
  addBtn.addEventListener("click", function () {
    addItem({ desc: "", qty: "1", rate: "" });
    itemsWrap.querySelector(".line-item:last-child input").focus();
    render();
  });
  resetBtn.addEventListener("click", fillSample);
  printBtn.addEventListener("click", function () {
    window.print();
  });

  fillSample();
})();


(function wirePolar() {
  var cfg = window.AFTERDUE || {};
  var url = cfg.polarCheckoutUrl;
  var btn = document.getElementById("buy-btn");
  var status = document.getElementById("buy-status");
  var extras = document.querySelectorAll("[data-polar-checkout], a.nav-buy, a.hero-actions a.btn-accent");
  if (!btn) return;
  if (url) {
    extras.forEach(function (el) {
      if (el.matches("a")) {
        el.setAttribute("href", url);
        el.setAttribute("rel", "noopener");
      }
    });
    if (status) status.textContent = "Checkout is Polar. You will get the pack by email after payment.";
  } else {
    btn.setAttribute("href", "#buy");
    btn.addEventListener("click", function (e) {
      e.preventDefault();
    });
    if (status) status.textContent = "Polar checkout connects as soon as the product link is in.";
  }
})();
