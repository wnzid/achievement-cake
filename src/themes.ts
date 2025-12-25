export type Theme = {
  id: string;
  label: string;
  backgroundGradient: string;
  ui: {
    cardBg: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    textMuted?: string;
  };
  accent: {
    primary: string;
  };
  cake: {
    body: string;
    frosting: string;
    frostingEdge?: string;
  };
  toothpick: {
    stick: string;
    pin: string;
  };
  flag: {
    paper: string;
    text?: string;
  };
};

export const defaultThemeId = "chocolate";

export const themes: Theme[] = [
  {
    id: "vanilla",
    label: "Vanilla Minimal",
    backgroundGradient: "radial-gradient(ellipse at 20% 10%, #071026 0%, #02101a 36%, #02030a 100%)",
    ui: {
      cardBg: "rgba(255,255,255,0.06)",
      cardBorder: "rgba(255,255,255,0.10)",
      textPrimary: "#000000",
      textSecondary: "#000000",
      textMuted: "#000000",
    },
    accent: {
      primary: "#b0852b",
    },
    cake: {
      body: "#f2c6b6",
      frosting: "#fffaf6",
      frostingEdge: "#e6dcc8",
    },
    toothpick: {
      stick: "#c8a87a",
      pin: "#d35400",
    },
    flag: {
      paper: "#fff7eb",
      text: "#3b2416",
    }
  },

  {
    id: "chocolate",
    label: "Chocolate",
    backgroundGradient: "radial-gradient(ellipse at 30% 15%, #3a2418 0%, #1c120c 45%, #0b0705 100%)",
    ui: {
      cardBg: "rgba(36,22,15,0.75)",
      cardBorder: "rgba(255,215,160,0.18)",
      textPrimary: "#fff7ed",
      textSecondary: "#e7cdb8",
      textMuted: "#b59b86",
    },
    accent: {
      primary: "#c47f2a",
    },
    cake: {
      body: "#572f1d",
      frosting: "#e6d6c8",
      frostingEdge: "#d6c1ae",
    },
    toothpick: {
      stick: "#c8a06a",
      pin: "#b7372f",
    },
    flag: {
      paper: "#fff7eb",
        text: "#000000",
    }
  },

  {
    id: "red-velvet",
    label: "Red Velvet",
    backgroundGradient: "radial-gradient(ellipse at 20% 10%, #2a0b12 0%, #1a0510 40%, #07020a 100%)",
    ui: {
      cardBg: "rgba(255,255,255,0.06)",
      cardBorder: "rgba(255,255,255,0.10)",
      textPrimary: "#000000",
      textSecondary: "#000000",
      textMuted: "#000000",
    },
    accent: {
      primary: "#c94b5e",
    },
    cake: {
      body: "#8b1f2e",
      frosting: "#fff7f0",
    },
    toothpick: {
      stick: "#8a4938",
      pin: "#7a1722",
    },
    flag: {
      paper: "#fff9f8",
      text: "#000000",
    }
  }
];

export function getThemeById(id?: string) {
  if (!id) return themes.find(t => t.id === defaultThemeId)!;
  return themes.find(t => t.id === id) || themes.find(t => t.id === defaultThemeId)!;
}
