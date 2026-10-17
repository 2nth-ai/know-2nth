// Website form → 2nth CRM (crm.2nth.app/v1/leads/forms/<form>). No HubSpot, no keys.
// Markup: <form data-crm-form action="https://crm.2nth.app/v1/leads/forms/<form>"> with
// [data-crm-status] for messages and [data-crm-done] shown after a successful send.
(function () {
  document.querySelectorAll('form[data-crm-form]').forEach(function (form) {
    var status = form.querySelector('[data-crm-status]');
    var done = form.parentNode.querySelector('[data-crm-done]');
    var btn = form.querySelector('[type=submit]');
    function say(msg, bad) { if (!status) return; status.textContent = msg; status.hidden = !msg; status.style.display = msg ? '' : 'none'; status.classList.toggle('bad', !!bad); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      data.set('page', location.href);
      btn.disabled = true; say('Sending…');
      fetch(form.action, { method: 'POST', body: data })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
          // style.display, not just [hidden]: site CSS like .form{display:grid} overrides the attribute
          say('');
          form.hidden = true; form.style.display = 'none';
          if (done) { done.hidden = false; done.style.display = ''; done.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        })
        .catch(function (err) {
          btn.disabled = false;
          var m = err && err.message;
          say(!m || /fetch|network|load/i.test(m) ? 'Could not send. Please check your connection and try again.' : m, true);
          if (window.turnstile) try { window.turnstile.reset(); } catch (x) {}
        });
    });
  });
})();
