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
        bg: "#111d33",
        border: "#2a3f63",
        headerBg: "#172744",
        title: "#f2f7ff",
        empty: "#c6d4ea",
        countBg: "#6ea2ff",
        countText: "#071935"
      },
      card: {
        bg: "#1a2c49",
        border: "#8fb8ff",
        title: "#f5f9ff",
        body: "#d1def0",
        shadow: "0 8px 16px rgba(2, 8, 24, 0.42)"
      },
      meta: {
        bg: "#24395b",
        border: "#83aef2",
        text: "#e9f0fc",
        icon: "#b8d0f8",
        accentBg: "#1f8e71",
        accentBorder: "#59d4ad",
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
