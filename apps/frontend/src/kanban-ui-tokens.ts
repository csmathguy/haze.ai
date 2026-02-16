export interface KanbanUiTokens {
  lane: {
    bg: string;
    border: string;
    headerBg: string;
    title: string;
    empty: string;
    countBg: string;
    countText: string;
  };
  card: {
    bg: string;
    border: string;
    title: string;
    body: string;
    shadow: string;
  };
  meta: {
    bg: string;
    border: string;
    text: string;
    icon: string;
    accentBg: string;
    accentBorder: string;
    accentText: string;
  };
}

export const getKanbanUiTokens = (mode: "light" | "dark"): KanbanUiTokens => {
  if (mode === "dark") {
    return {
      lane: {
        bg: "#0f1728",
        border: "#2a3f61",
        headerBg: "#14203a",
        title: "#e9f1ff",
        empty: "#b7c7e0",
        countBg: "#5f88d6",
        countText: "#f1f6ff"
      },
      card: {
        bg: "#15253d",
        border: "#6f93cf",
        title: "#edf3ff",
        body: "#c4d2e8",
        shadow: "0 8px 16px rgba(2, 8, 24, 0.42)"
      },
      meta: {
        bg: "#213551",
        border: "#6f93cf",
        text: "#e4ecfb",
        icon: "#a8c3ee",
        accentBg: "#1a7c63",
        accentBorder: "#4ec8a3",
        accentText: "#ecfff9"
      }
    };
  }

  return {
    lane: {
      bg: "#f8fbff",
      border: "#bdd2f8",
      headerBg: "#edf3ff",
      title: "#162132",
      empty: "#53627d",
      countBg: "#2166dd",
      countText: "#f5f9ff"
    },
    card: {
      bg: "#ffffff",
      border: "#b7ccf3",
      title: "#142034",
      body: "#44516a",
      shadow: "0 8px 16px rgba(12, 28, 61, 0.14)"
    },
    meta: {
      bg: "#f3f7ff",
      border: "#9ab8ec",
      text: "#2a3c5a",
      icon: "#3d5f93",
      accentBg: "#1f8e71",
      accentBorder: "#1f8e71",
      accentText: "#f4fffb"
    }
  };
};
