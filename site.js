(function () {
  "use strict";

  var POLAR = (window.AFTERDUE && window.AFTERDUE.polarCheckoutUrl) || "";

  function wireCheckout() {
    if (!POLAR) return;

    var nodes = document.querySelectorAll(
      "[data-polar-checkout], a.nav-buy, a[href='#buy'], a[href='index.html#buy'], a[href*='buy.polar.sh']"
    );

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.tagName === "A") {
        el.setAttribute("href", POLAR);
        el.setAttribute("rel", "noopener");
      }
    });

    var status = document.getElementById("buy-status");
    if (status) {
      status.textContent =
        "No Afterdue login. Tax is calculated at checkout. The file is emailed after payment.";
    }
  }

  var money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  function feeNumber(id) {
    var node = document.getElementById(id);
    if (!node) return 0;
    var n = parseFloat(String(node.value || "").replace(/,/g, ""));
    return isFinite(n) ? n : 0;
  }

  function renderFee() {
    var form = document.getElementById("fee-form");
    if (!form) return;

    var balance = Math.max(0, feeNumber("fee-balance"));
    var kind = (form.elements.feeKind && form.elements.feeKind.value) || "once";
    var rate = Math.max(0, feeNumber("fee-rate"));
    var fee = 0;

    if (kind === "flat") {
      fee = rate;
    } else {
      fee = balance * (rate / 100);
    }

    fee = Math.round(fee * 100) / 100;
    var next = Math.round((balance + fee) * 100) / 100;

    var feeOut = document.getElementById("fee-result-fee");
    var totalOut = document.getElementById("fee-result-total");
    var note = document.getElementById("fee-result-note");

    if (feeOut) feeOut.textContent = money.format(fee);
    if (totalOut) totalOut.textContent = money.format(next);
    if (note) {
      if (kind === "once") {
        note.textContent = "One-time " + rate + "% of the unpaid balance.";
      } else if (kind === "month") {
        note.textContent = rate + "% this month on the unpaid balance — only if that rate is already in writing.";
      } else {
        note.textContent = "Flat fee. Use when a percentage looks petty on a small invoice.";
      }
    }
  }

  function wireFee() {
    var form = document.getElementById("fee-form");
    if (!form) return;
    form.addEventListener("input", renderFee);
    form.addEventListener("change", renderFee);
    renderFee();
  }

  wireCheckout();
  wireFee();
})();
