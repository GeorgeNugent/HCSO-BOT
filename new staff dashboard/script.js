const sectionInfo = {
  staff: {
    title: "Staff",
    icon: "♟",
    text: "The staff management area will live here. Commands, roles and permissions can be added when you're ready."
  },
  tickets: {
    title: "Tickets",
    icon: "▱",
    text: "The ticket management area will live here. The interface can be connected to your ticket system later."
  },
  applications: {
    title: "Applications",
    icon: "▤",
    text: "The applications area will live here. Review and management functionality can be added later."
  },
  moderation: {
    title: "Moderation",
    icon: "◈",
    text: "The moderation area will live here. Your moderation commands can be integrated when the backend is ready."
  },
  logs: {
    title: "Logs",
    icon: "≡",
    text: "The staff and audit log viewer will live here. This is intentionally UI-only for now."
  },
  settings: {
    title: "Settings",
    icon: "⚙",
    text: "Dashboard settings will live here. Configuration functionality can be added later."
  }
};

const sideLinks = document.querySelectorAll(".side-link");
const cards = document.querySelectorAll(".command-card");
const hero = document.getElementById("hero");
const grid = document.getElementById("commandGrid");
const placeholder = document.getElementById("placeholder");
const placeholderTitle = document.getElementById("placeholderTitle");
const placeholderText = document.getElementById("placeholderText");
const placeholderIcon = document.getElementById("placeholderIcon");

function selectSection(section) {
  sideLinks.forEach(link => {
    link.classList.toggle("selected", link.dataset.section === section);
  });

  if (section === "command-center") {
    hero.classList.remove("hidden");
    grid.classList.remove("hidden");
    placeholder.classList.add("hidden");
    return;
  }

  const info = sectionInfo[section];
  if (!info) return;

  hero.classList.add("hidden");
  grid.classList.add("hidden");
  placeholder.classList.remove("hidden");
  placeholderTitle.textContent = info.title;
  placeholderText.textContent = info.text;
  placeholderIcon.textContent = info.icon;
}

[...sideLinks, ...cards].forEach(element => {
  element.addEventListener("click", () => selectSection(element.dataset.section));
});

const accountButton = document.getElementById("accountButton");
const accountMenu = document.getElementById("accountMenu");

accountButton.addEventListener("click", event => {
  event.stopPropagation();
  const open = accountMenu.classList.toggle("open");
  accountButton.setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", () => {
  accountMenu.classList.remove("open");
  accountButton.setAttribute("aria-expanded", "false");
});

document.querySelector(".connect-btn").addEventListener("click", () => {
  alert("Discord connection will be added later.");
});

document.querySelectorAll(".account-menu button").forEach(button => {
  button.addEventListener("click", () => {
    alert(`${button.textContent} will be connected later.`);
  });
});
