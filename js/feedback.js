// Prijavi grešku. Obrazac je jedan, a ulaz je podnožje, učitani studij,
// detalj kolegija i detalj na grafu. Kontekst se pridružuje pri slanju.
(function () {
  const PMF = (window.PMF = window.PMF || {});
  let root = null;
  let pending = {};
  let sending = false;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function selected(id) {
    const node = document.getElementById(id);
    if (!node || !node.value) return null;
    const option = node.selectedOptions && node.selectedOptions[0];
    return { id: node.value, naziv: option ? option.textContent.trim() : node.value };
  }

  function snapshot() {
    const status = document.getElementById("programme-status");
    const count = document.getElementById("course-count");
    const base = {
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timestamp: new Date().toISOString(),
      faculty: selected("faculty-filter"),
      programme: selected("programme-select"),
      selectionCount: count ? Number(count.textContent) || 0 : 0,
      status: status && status.textContent ? status.textContent.trim().slice(0, 300) : "",
    };
    return Object.assign(base, pending);
  }

  function build() {
    root = el("div", "report");
    root.hidden = true;
    const card = el("form", "report__card");
    card.method = "dialog";
    card.setAttribute("aria-labelledby", "report-title");
    const title = el("h2", "report__title", "Prijavi grešku");
    title.id = "report-title";
    const lede = el("p", "report__lede", "Napiši što na stranici nije točno. Uz poruku ide studij, kolegij i veličina zaslona, da se to može naći.");
    const messageLabel = el("label", "field");
    messageLabel.appendChild(el("span", "field__label", "Što nije u redu"));
    const message = el("textarea");
    message.id = "report-message";
    message.name = "message";
    message.required = true;
    message.maxLength = 2000;
    message.rows = 5;
    message.placeholder = "npr. Diplomski rad nije u 4. semestru";
    messageLabel.appendChild(message);
    const emailLabel = el("label", "field");
    emailLabel.appendChild(el("span", "field__label", "E-pošta, ako želiš odgovor"));
    const email = el("input");
    email.id = "report-email";
    email.name = "email";
    email.type = "email";
    email.autocomplete = "email";
    email.inputMode = "email";
    email.maxLength = 200;
    email.placeholder = "nije obavezno";
    emailLabel.appendChild(email);
    const note = el("p", "report__note");
    note.id = "report-note";
    note.setAttribute("role", "status");
    const actions = el("div", "report__actions");
    const cancel = el("button", "btn btn--ghost", "Odustani");
    cancel.type = "button";
    const submit = el("button", "btn", "Pošalji");
    submit.type = "submit";
    actions.append(cancel, submit);
    card.append(title, lede, messageLabel, emailLabel, note, actions);
    root.appendChild(card);
    document.body.appendChild(root);

    cancel.addEventListener("click", close);
    root.addEventListener("click", (event) => {
      if (event.target === root) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !root.hidden) close();
    });
    card.addEventListener("submit", (event) => {
      event.preventDefault();
      send(message, email, note, submit);
    });
    return { message, email, note, submit };
  }

  let fields = null;

  function ensure() {
    if (!fields) fields = build();
    return fields;
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    document.body.classList.remove("report-open");
    sending = false;
  }

  function open(extra) {
    pending = extra || {};
    const form = ensure();
    form.message.value = "";
    form.email.value = "";
    form.note.textContent = "";
    form.note.className = "report__note";
    form.submit.disabled = false;
    root.hidden = false;
    document.body.classList.add("report-open");
    form.message.focus();
  }

  function say(note, kind, text) {
    note.className = "report__note" + (kind ? " is-" + kind : "");
    note.textContent = text;
  }

  async function send(message, email, note, submit) {
    if (sending) return;
    const text = message.value.trim();
    if (!text) {
      say(note, "error", "Napiši što nije u redu.");
      message.focus();
      return;
    }
    const mail = email.value.trim();
    sending = true;
    submit.disabled = true;
    say(note, "busy", "Šaljem…");
    const context = snapshot();
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          email: mail,
          page: context.section || "page",
          context,
        }),
      });
      let data = {};
      try { data = await response.json(); } catch (err) { data = {}; }
      if (response.status === 503) {
        say(note, "warn", "Hvala na dojavi. Poruku sada ne mogu spremiti, pohrana još nije spojena. Pokušaj kasnije.");
        return;
      }
      if (response.status === 502) {
        say(note, "warn", "Hvala na dojavi. Poruka nije spremljena. Pokušaj kasnije.");
        return;
      }
      if (response.status === 429) {
        say(note, "warn", "Hvala. Previše je prijava u kratkom roku, pa ova nije spremljena. Pokušaj kasnije.");
        return;
      }
      if (!response.ok || data.ok === false) {
        say(note, "error", data.error || "Poruka nije spremljena.");
        return;
      }
      message.value = "";
      email.value = "";
      say(note, "ok", "Hvala. Poruka je zabilježena.");
    } catch (err) {
      say(note, "warn", "Hvala na dojavi. Poruku sada ne mogu spremiti. Pokušaj kasnije.");
    } finally {
      sending = false;
      submit.disabled = false;
    }
  }

  function link(extra) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "report-link";
    button.textContent = "Prijavi grešku";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      open(extra);
    });
    return button;
  }

  function wireStatic() {
    const footer = document.getElementById("report-footer");
    if (footer) footer.addEventListener("click", () => open({ section: "footer" }));
    const programme = document.getElementById("report-programme");
    if (programme) programme.addEventListener("click", () => open({ section: "programme" }));
  }

  PMF.feedback = { open, link };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireStatic);
  else wireStatic();
})();
