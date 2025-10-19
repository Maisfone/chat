import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, absUrl } from "../services/api.js";
import {
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconEllipsis,
  IconEmoji,
  IconStar,
} from "../components/Icon.jsx";
import { ioClient } from "../services/socket.js";
import { getUser } from "../state/auth.js";
import { ensurePushSubscription } from "../services/pushClient.js";

export default function Chat() {
  // Lists and active conversation
  const [groups, setGroups] = useState([]);
  const [dms, setDms] = useState([]);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(null);

  // Messages and composer
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [err, setErr] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  // Audio recording
  const [recording, setRecording] = useState(false);
  const [recError, setRecError] = useState("");
  const [recTime, setRecTime] = useState(0);

  // UI state/refs
  // Pinned/Muted groups (local only)
  const [pinned, setPinned] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chat_pins") || "{}");
    } catch {
      return {};
    }
  });
  const [muted, setMuted] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chat_mutes") || "{}");
    } catch {
      return {};
    }
  });
  function togglePin(id) {
    setPinned((prev) => {
      const n = { ...(prev || {}) };
      n[id] = !n[id];
      try {
        localStorage.setItem("chat_pins", JSON.stringify(n));
      } catch {}
      return n;
    });
  }
  function toggleMute(id) {
    setMuted((prev) => {
      const n = { ...(prev || {}) };
      n[id] = !n[id];
      try {
        localStorage.setItem("chat_mutes", JSON.stringify(n));
      } catch {}
      return n;
    });
  }
  const [menuFor, setMenuFor] = useState(null);
  const messageMenuContainerRef = useRef(null);
  const setMessageMenuContainer = useCallback((node) => {
    messageMenuContainerRef.current = node;
  }, []);
  const [highlightId, setHighlightId] = useState(null);
  const [editId, setEditId] = useState("");
  const [editText, setEditText] = useState("");
  const [convQuery, setConvQuery] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiBtnRef = useRef(null);
  // Posição inicial de fallback para o popover (caso cálculo ainda não tenha ocorrido)
  const [emojiPos, setEmojiPos] = useState({ left: 4, bottom: 120, width: 360, maxHeight: 416 });
  const composerRef = useRef(null);
  function openEmojiPopover() {
  try {
    const btn = emojiBtnRef.current;
    const formEl = composerRef.current;
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const pad = 4;
    const lift = 4; // distância extra acima do form (4px)
    const popMax = Math.min(26 * 16, vh - pad * 2);
    const getRect = (el) => (el && el.getBoundingClientRect ? el.getBoundingClientRect() : null);
    const rForm = getRect(formEl);
    const rBtn = getRect(btn);
    const source = rForm || rBtn;
    if (source) {
      const baseWidth = rForm ? Math.min(420, Math.max(320, (rForm.width || 420))) : Math.min(420, Math.max(320, vw * 0.95));
      const desiredWidth = Math.min(baseWidth, vw - pad * 2);
      const anchorLeft = rForm ? rForm.left : (rBtn ? rBtn.left : pad);
      const left = pad;
      const anchorTop = rForm ? rForm.top : (rBtn ? rBtn.top : vh / 2);
      // bottom = distância da borda inferior do viewport até o topo do form + lift
      const bottom = Math.max(pad, (vh - anchorTop) + lift);
      setEmojiPos({ left, bottom, width: desiredWidth, maxHeight: popMax });
    } else {
      setEmojiPos({ left: pad, bottom: 120, width: Math.min(420, Math.max(320, vw * 0.95)), maxHeight: popMax });
    }
  } catch {}
  setShowEmoji(true);
}
  // Sidebar context menu (right-click)
  const [sideMenu, setSideMenu] = useState({
    open: false,
    type: null,
    id: null,
    groupId: null,
    x: 0,
    y: 0,
  });
  const sideMenuRef = useRef(null);
  // Emoji list (clean, UTF-8 safe)
  const EMOJI_CATS = {
    recent: [],
    caras: [
      "\uD83D\uDE00",
      "\uD83D\uDE01",
      "\uD83D\uDE02",
      "\uD83E\uDD23",
      "\uD83D\uDE0A",
      "\uD83D\uDE42",
      "\uD83D\uDE09",
      "\uD83D\uDE05",
      "\uD83D\uDE06",
      "\uD83E\uDD79",
      "\uD83D\uDE0D",
      "\uD83D\uDE18",
      "\uD83D\uDE1C",
      "\uD83E\uDD2A",
      "\uD83E\uDD14",
      "\uD83D\uDE44",
      "\uD83D\uDE0F",
      "\uD83D\uDE0E",
      "\uD83D\uDE22",
      "\uD83D\uDE2D",
      "\uD83D\uDE21",
      "\uD83D\uDE31",
      "\uD83E\uDD73",
      "\uD83D\uDE2C",
    ],
    gestos: [
      "\uD83D\uDC4D",
      "\uD83D\uDC4E",
      "\uD83D\uDC4F",
      "\uD83D\uDE4C",
      "\uD83D\uDE4F",
      "\uD83E\uDD1D",
      "\uD83E\uDD1E",
      "\u270C\uFE0F",
      "\uD83D\uDC4C",
      "\uD83E\uDEF6",
      "\uD83E\uDD0C",
      "\uD83D\uDC4A",
      "\u270A",
      "\uD83E\uDD1F",
      "\uD83E\uDD18",
      "\uD83D\uDCAA",
    ],
    amor: [
      "\u2764\uFE0F",
      "\uD83E\uDDE1",
      "\uD83D\uDC9B",
      "\uD83D\uDC9A",
      "\uD83D\uDC99",
      "\uD83D\uDC9C",
      "\uD83E\uDD0D",
      "\uD83E\uDD0E",
      "\uD83D\uDDA4",
      "\uD83D\uDC98",
      "\uD83D\uDC96",
      "\uD83D\uDC97",
      "\uD83D\uDC93",
      "\uD83D\uDC9E",
      "\uD83D\uDC94",
      "\uD83C\uDF89",
      "\u2728",
      "\u2B50",
      "\uD83C\uDF1F",
      "\uD83D\uDD25",
      "\u26A1",
      "\uD83D\uDCAF",
      "\u2705",
      "\u274C",
      "\u2757",
      "\u2753",
      "\u26A0\uFE0F",
      "\uD83D\uDD14",
      "\uD83D\uDD15",
    ],
    animais: [
      "\uD83D\uDC36",
      "\uD83D\uDC31",
      "\uD83D\uDC2D",
      "\uD83D\uDC39",
      "\uD83D\uDC30",
      "\uD83E\uDD8A",
      "\uD83D\uDC3B",
      "\uD83D\uDC3C",
      "\uD83D\uDC28",
      "\uD83D\uDC2F",
      "\uD83E\uDD81",
      "\uD83D\uDC2E",
      "\uD83D\uDC37",
      "\uD83D\uDC35",
      "\uD83E\uDD84",
      "\uD83D\uDC14",
    ],
    comida: [
      "\uD83C\uDF4E",
      "\uD83C\uDF4A",
      "\uD83C\uDF4B",
      "\uD83C\uDF4C",
      "\uD83C\uDF49",
      "\uD83C\uDF47",
      "\uD83C\uDF53",
      "\uD83C\uDF52",
      "\uD83C\uDF4D",
      "\uD83E\uDD6D",
      "\uD83E\uDD5D",
      "\uD83C\uDF51",
      "\uD83C\uDF55",
      "\uD83C\uDF54",
      "\uD83C\uDF5F",
      "\uD83C\uDF2D",
      "\uD83C\uDF63",
      "\uD83C\uDF5C",
      "\uD83C\uDF5D",
      "\uD83C\uDF70",
      "\uD83C\uDF69",
      "\uD83C\uDF6A",
      "\uD83C\uDF6B",
      "\uD83C\uDF7F",
      "\uD83C\uDF7B",
      "\u2615",
      "\uD83E\uDDC3",
    ],
    objetos: [
      "\uD83D\uDCF1",
      "\uD83D\uDCBB",
      "\uD83D\uDDA5\uFE0F",
      "\u2328\uFE0F",
      "\uD83D\uDDB1\uFE0F",
      "\uD83D\uDD8A\uFE0F",
      "\uD83D\uDCDD",
      "\uD83D\uDCCE",
      "\uD83D\uDCCC",
      "\uD83D\uDCF7",
      "\uD83C\uDFA7",
      "\uD83C\uDFA4",
      "\uD83C\uDFAC",
      "\u23F0",
      "\uD83D\uDD52",
    ],
    transportes: [
      "\uD83D\uDE97",
      "\uD83D\uDE8C",
      "\uD83D\uDE95",
      "\uD83D\uDE99",
      "\uD83D\uDE91",
      "\uD83D\uDE92",
      "\u2708\uFE0F",
      "\uD83D\uDE80",
      "\uD83D\uDEB2",
      "\uD83D\uDE86",
    ],
    clima: [
      "\u2600\uFE0F",
      "\uD83C\uDF24\uFE0F",
      "\u26C5",
      "\uD83C\uDF25\uFE0F",
      "\u2601\uFE0F",
      "\uD83C\uDF26\uFE0F",
      "\uD83C\uDF27\uFE0F",
      "\u26C8\uFE0F",
      "\uD83C\uDF29\uFE0F",
      "\uD83C\uDF28\uFE0F",
      "\u2744\uFE0F",
      "\uD83C\uDF2A\uFE0F",
      "\uD83C\uDF2B\uFE0F",
      "\uD83D\uDCA8",
      "\uD83C\uDF08",
      "\u2614",
      "\uD83C\uDF19",
      "\uD83C\uDF03",
      "\uD83C\uDF0C",
      "\uD83C\uDF21\uFE0F",
    ],
    natureza: [
      "\uD83C\uDF31",
      "\uD83C\uDF3F",
      "\u2618\uFE0F",
      "\uD83C\uDF40",
      "\uD83C\uDF35",
      "\uD83C\uDF34",
      "\uD83C\uDF33",
      "\uD83C\uDF32",
      "\uD83C\uDF3A",
      "\uD83C\uDF38",
      "\uD83C\uDF3C",
      "\uD83C\uDF3B",
      "\uD83C\uDF1E",
      "\uD83C\uDF1D",
      "\uD83C\uDF0D",
      "\uD83C\uDF0E",
      "\uD83C\uDF0F",
      "\uD83E\uDEB4",
      "\uD83C\uDF42",
      "\uD83C\uDF41",
      "\uD83C\uDF43",
    ],
  };
  const EMOJI_TABS = [
    { key: "recent", label: "Recentes", icon: "\uD83D\uDD58" },
    { key: "favoritos", label: "Favoritos", icon: "\u2B50" },
    { key: "caras", label: "Caras", icon: "\uD83D\uDE42" },
    { key: "gestos", label: "Gestos", icon: "\uD83D\uDC4D" },
    { key: "amor", label: "Amor", icon: "\u2764\uFE0F" },
    { key: "natureza", label: "Natureza", icon: "\uD83C\uDF31" },
    { key: "clima", label: "Clima", icon: "\u26C5" },
    { key: "animais", label: "Animais", icon: "\uD83D\uDC3E" },
    { key: "comida", label: "Comida", icon: "\uD83C\uDF54" },
    { key: "objetos", label: "Objetos", icon: "\uD83E\uDDF0" },
    { key: "transportes", label: "Transp.", icon: "\uD83D\uDE97" },
  ];
  const EMOJIS = React.useMemo(() => {
    try {
      const keys = Object.keys(EMOJI_CATS).filter(
        (k) => k !== "recent" && k !== "bandeiras"
      );
      const list = [];
      keys.forEach((k) => {
        (EMOJI_CATS[k] || []).forEach((e) => list.push(e));
      });
      const seen = new Set();
      return list.filter((e) => {
        if (seen.has(e)) return false;
        seen.add(e);
        return true;
      });
    } catch {
      return [];
    }
  }, []);

  const [emojiTab, setEmojiTab] = useState("caras");
  const [recentEmojis, setRecentEmojis] = useState(() => {
    try {
      const raw = localStorage.getItem("chat_recent_emojis");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, 24) : [];
    } catch {
      return [];
    }
  });
  const [emojiQuery, setEmojiQuery] = useState("");
  const [favoriteEmojis, setFavoriteEmojis] = useState(() => {
    try {
      const raw = localStorage.getItem("chat_fav_emojis");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, 48) : [];
    } catch {
      return [];
    }
  });
  function toggleFavEmoji(emo) {
    try {
      setFavoriteEmojis((prev) => {
        const exists = (prev || []).includes(emo);
        const next = exists
          ? (prev || []).filter((e) => e !== emo)
          : [emo, ...(prev || []).filter((e) => e !== emo)].slice(0, 48);
        try {
          localStorage.setItem("chat_fav_emojis", JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch {}
  }

  // Emoji scroll navigation like WhatsApp
  const emojiScrollRef = useRef(null);
  const emojiSectionRefs = useRef({});
  const setEmojiSectionRef = (key) => (el) => {
    if (el) emojiSectionRefs.current[key] = el;
  };
  const emojiOrder = [
    "recent",
    "favoritos",
    "caras",
    "gestos",
    "amor",
    "natureza",
    "clima",
    "animais",
    "comida",
    "objetos",
    "transportes",
  ];
  function scrollToEmojiTab(key) {
    setEmojiTab(key);
    try {
      const cont = emojiScrollRef.current;
      const el = emojiSectionRefs.current[key];
      if (cont && el) {
        cont.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
      }
    } catch {}
  }
  useEffect(() => {
    if (!showEmoji) return;
    if (false) return; // don't auto-update tab during search
    const cont = emojiScrollRef.current;
    if (!cont) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          let current = emojiTab;
          for (const key of emojiOrder) {
            const el = emojiSectionRefs.current[key];
            if (!el) continue;
            const relTop = el.offsetTop - cont.scrollTop;
            if (relTop <= 32) current = key;
          }
          if (current && current !== emojiTab) setEmojiTab(current);
        } finally {
          ticking = false;
        }
      });
    };
    cont.addEventListener("scroll", onScroll, { passive: true });
    return () => cont.removeEventListener("scroll", onScroll);
  }, [showEmoji, emojiQuery, emojiTab]);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const mediaRecRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recTimerRef = useRef(null);
  const user = getUser();
  const nav = useNavigate();
  const [recPendingFile, setRecPendingFile] = useState(null);
  const [recPreviewUrl, setRecPreviewUrl] = useState("");
  const attachmentsRef = useRef([]);

  // Conversation menu (header)
  const [convMenuOpen, setConvMenuOpen] = useState(false);
  const convMenuRef = useRef(null);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item?.preview) {
          try {
            URL.revokeObjectURL(item.preview);
          } catch {}
        }
      });
    };
  }, []);

  function createAttachment(file) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      preview: file?.type?.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    };
  }

  function addAttachments(newFiles = []) {
    if (!newFiles.length) return;
    const mapped = newFiles.map((f) => createAttachment(f));
    setAttachments((prev) => [...prev, ...mapped]);
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) {
        try {
          URL.revokeObjectURL(target.preview);
        } catch {}
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  function clearAttachments() {
    attachmentsRef.current.forEach((item) => {
      if (item?.preview) {
        try {
          URL.revokeObjectURL(item.preview);
        } catch {}
      }
    });
    setAttachments([]);
    try {
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {}
  }

  async function downloadAttachment(url, filename = "arquivo") {
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) throw new Error("Falha ao baixar arquivo");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setErr(e?.message || "Não foi possível baixar o arquivo");
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {}
    }
  }

  useEffect(() => {
    if (!menuFor) return;

    const handleOutside = (event) => {
      const container = messageMenuContainerRef.current;
      if (!container) {
        setMenuFor(null);
        return;
      }
      if (!container.contains(event.target)) {
        setMenuFor(null);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [menuFor]);

  // Close sidebar context menu on outside click / ESC
  useEffect(() => {
    if (!sideMenu?.open) return;
    const onDoc = (e) => {
      const el = sideMenuRef.current;
      if (!el) {
        setSideMenu((s) => ({ ...s, open: false }));
        return;
      }
      if (!el.contains(e.target)) setSideMenu((s) => ({ ...s, open: false }));
    };
    const onKey = (e) => {
      if (e.key === "Escape") setSideMenu((s) => ({ ...s, open: false }));
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [sideMenu?.open]);

  // Close conversation header menu on outside click or ESC
  useEffect(() => {
    if (!convMenuOpen) return;
    const onDoc = (e) => {
      const el = convMenuRef.current;
      if (!el) {
        setConvMenuOpen(false);
        return;
      }
      if (!el.contains(e.target)) setConvMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setConvMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [convMenuOpen]);

  // Notifications + sound + unread count in title
  const notifSupported =
    typeof window !== "undefined" && "Notification" in window;
  const initialNotifPermission = (() => {
    if (!notifSupported) return "default";
    try {
      return Notification.permission;
    } catch {
      return "default";
    }
  })();
  const [notifOk, setNotifOk] = useState(initialNotifPermission === "granted");
  const isSecureContext =
    typeof window !== "undefined" ? window.isSecureContext : false;
  const initialTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "Chat"
  );
  const audioCtxRef = useRef(null);
  const customBufferRef = useRef({ url: "", buffer: null });
  const [windowFocused, setWindowFocused] = useState(() => {
    try {
      return !document.hidden && document.hasFocus();
    } catch {
      return true;
    }
  });
  const soundOn = true;
  const [pushError, setPushError] = useState("");
  useEffect(() => {
    const updateFocus = () => {
      try {
        setWindowFocused(!document.hidden && document.hasFocus());
      } catch {
        setWindowFocused(true);
      }
    };
    updateFocus();
    window.addEventListener("focus", updateFocus);
    window.addEventListener("blur", updateFocus);
    document.addEventListener("visibilitychange", updateFocus);
    return () => {
      window.removeEventListener("focus", updateFocus);
      window.removeEventListener("blur", updateFocus);
      document.removeEventListener("visibilitychange", updateFocus);
    };
  }, []);

  useEffect(() => {
    if (!notifSupported || !notifOk) return;
    let cancelled = false;
    (async () => {
      try {
        await ensurePushSubscription();
        if (!cancelled) setPushError("");
      } catch (err) {
        if (!cancelled) setPushError(err?.message || "Falha ao registrar push");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notifSupported, notifOk]);

  useEffect(() => {
    const onSoundUpdated = () => {
      try {
        const url = localStorage.getItem("notif_sound_url") || "";
        if (!url) {
          customBufferRef.current = { url: "", buffer: null };
        } else if (customBufferRef.current.url !== url) {
          customBufferRef.current = { url, buffer: null };
        }
      } catch {}
    };
    onSoundUpdated();
    window.addEventListener("chat:alertSoundUpdated", onSoundUpdated);
    return () =>
      window.removeEventListener("chat:alertSoundUpdated", onSoundUpdated);
  }, []);

  useEffect(() => {
    if (!notifSupported) return;
    let cancelled = false;
    const syncPermission = () => {
      try {
        const current = Notification.permission;
        if (!cancelled) {
          setNotifOk(current === "granted");
        }
      } catch {}
    };
    syncPermission();
    try {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (!cancelled) setNotifOk(perm === "granted");
        });
      }
    } catch {}
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, [notifSupported]);

  function previewFromMessage(msg) {
    if (!msg) return "";
    if (msg.type === "text") return msg.content || "";
    if (msg.type === "image" || msg.type === "gif") return "Imagem";
    if (msg.type === "audio") return "Áudio";
    return "Anexo";
  }
  function fileNameFromUrl(u) {
    try {
      if (!u) return "";
      // Prefer ?name= query parameter if present
      try {
        const url = new URL(
          u,
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost"
        );
        const qn = url.searchParams.get("name");
        if (qn) return qn;
      } catch {}
      const noQuery = String(u).split("?")[0];
      const base = noQuery.split("/").pop() || "";
      return decodeURIComponent(base);
    } catch {
      return String(u || "");
    }
  }
  function showNotificationFor(msg) {
    try {
      if (!notifOk) return;
      const authorName = msg?.author?.name || "Mensagem";
      const body = previewFromMessage(msg);
      const icon = msg?.author?.avatarUrl
        ? absUrl(msg.author.avatarUrl)
        : undefined;
      const n = new Notification(authorName, { body, icon });
      n.onclick = () => {
        try {
          window?.focus?.();
        } catch {}
        try {
          setActive({
            id: msg.groupId,
            name: msg.group?.name || "Direto",
            avatarUrl:
              msg.group?.avatarUrl || msg.author?.avatarUrl || undefined,
          });
        } catch {}
        try {
          n.close();
        } catch {}
      };
      setTimeout(() => {
        try {
          n.close();
        } catch {}
      }, 8000);
    } catch {}
  }
  async function playPing() {
    try {
      if (!soundOn) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      // Tenta som customizado
      try {
        const url = localStorage.getItem("notif_sound_url") || "";
        if (url) {
          if (
            customBufferRef.current.url !== url ||
            !customBufferRef.current.buffer
          ) {
            const resp = await fetch(url);
            const arr = await resp.arrayBuffer();
            const buf = await ctx.decodeAudioData(arr.slice(0));
            customBufferRef.current = { url, buffer: buf };
          }
          const src = ctx.createBufferSource();
          src.buffer = customBufferRef.current.buffer;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
          g.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + Math.min(1.2, src.buffer.duration)
          );
          src.connect(g).connect(ctx.destination);
          src.start();
          return;
        }
      } catch {}
      // Fallback bip simples
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch {}
  }

  // Desbloqueia o AudioContext apÃ³s a primeira interaÃ§Ã£o do usuÃ¡rio
  useEffect(() => {
    function resumeAudio() {
      try {
        audioCtxRef.current?.resume?.();
      } catch {}
      try {
        window.removeEventListener("click", resumeAudio);
        window.removeEventListener("keydown", resumeAudio);
        window.removeEventListener("touchstart", resumeAudio);
      } catch {}
    }
    window.addEventListener("click", resumeAudio);
    window.addEventListener("keydown", resumeAudio);
    window.addEventListener("touchstart", resumeAudio);
    return () => {
      try {
        window.removeEventListener("click", resumeAudio);
        window.removeEventListener("keydown", resumeAudio);
        window.removeEventListener("touchstart", resumeAudio);
      } catch {}
    };
  }, []);

  // Update document title with unread total
  useEffect(() => {
    try {
      const total =
        (groups || []).reduce((s, g) => s + (g._unread || 0), 0) +
        (dms || []).reduce((s, d) => s + (d._unread || 0), 0);
      if (total > 0) document.title = `(${total}) ${initialTitleRef.current}`;
      else document.title = initialTitleRef.current;
    } catch {}
  }, [groups, dms]);

  // Message search (current conversation)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]); // array of message ids
  const [searchIndex, setSearchIndex] = useState(-1);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [mobileSearchShown, setMobileSearchShown] = useState(false);
  const [desktopSearchShown, setDesktopSearchShown] = useState(false);
  // Right sidebar (profile)
  const [rightOpen, setRightOpen] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [rightMode, setRightMode] = useState("self");
  const [meProfile, setMeProfile] = useState(null);
  const [contactProfile, setContactProfile] = useState(null);
  const [contactGroups, setContactGroups] = useState([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactErr, setContactErr] = useState("");
  // Group profile state
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupErr, setGroupErr] = useState("");
  const [rightTab, setRightTab] = useState("perfil"); // 'perfil' | 'arquivos' | 'favoritos'
  const [pfName, setPfName] = useState("");
  const [pfPhone, setPfPhone] = useState("");
  const [pfAddress, setPfAddress] = useState("");
  const [pfStatus, setPfStatus] = useState("");
  const [pfAvatar, setPfAvatar] = useState(null);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [rightMsg, setRightMsg] = useState("");
  const [rightErr, setRightErr] = useState("");
  const [rightFavItems, setRightFavItems] = useState([]); // favoritos carregados (mensagens)
  // Favorites (local)
  const [favorites, setFavorites] = useState({}); // { [groupId]: { [messageId]: true } }
  function isFav(msgId) {
    return !!favorites?.[active?.id || ""]?.[msgId];
  }
  async function toggleFav(m) {
    if (!active?.id || !m?.id) return;
    try {
      if (isFav(m.id)) {
        await api.del(`/messages/${m.id}/favorite`);
        setFavorites((prev) => {
          const next = { ...(prev || {}) };
          const group = { ...(next[active.id] || {}) };
          delete group[m.id];
          next[active.id] = group;
          return next;
        });
        setRightFavItems((prev) => prev.filter((x) => x.id !== m.id));
      } else {
        await api.post(`/messages/${m.id}/favorite`, {});
        setFavorites((prev) => ({
          ...prev,
          [active.id]: { ...((prev || {})[active.id] || {}), [m.id]: true },
        }));
        setRightFavItems((prev) =>
          prev?.some((x) => x.id === m.id) ? prev : [m, ...(prev || [])]
        );
      }
    } catch (e) {}
  }

  // Map: groupId -> otherUserId (for DMs)
  const dmOtherByGroupId = useMemo(() => {
    const map = {};
    (dms || []).forEach((d) => {
      if (d?.groupId && d?.other?.id) map[d.groupId] = d.other.id;
    });
    return map;
  }, [dms]);

  // Load favorites for active conversation
  useEffect(() => {
    (async () => {
      if (!active?.id) return;
      try {
        const favs = await api.get(`/messages/favorites?groupId=${active.id}`);
        const map = {};
        const items = [];
        for (const f of favs || []) {
          if (f?.message?.id) {
            map[f.message.id] = true;
            items.push(f.message);
          }
        }
        setFavorites((prev) => ({ ...prev, [active.id]: map }));
        setRightFavItems(items);
      } catch {}
    })();
  }, [active?.id, muted, dmOtherByGroupId]);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchToggleRef = useRef(null);
  const mobileSearchBarRef = useRef(null);
  const mobileSearchToggleRef = useRef(null);
  // Presence map: { [userId]: status }
  const [presence, setPresence] = useState({});
  useEffect(() => {
    const s = ioClient();
    const meId = user?.id;
    const status = (() => {
      try {
        return localStorage.getItem("chat_status") || "online";
      } catch {
        return "online";
      }
    })();
    try {
      s.emit("presence:online", { userId: meId, status });
    } catch {}
    const onSnapshot = (payload = {}) => {
      try {
        const map = {};
        for (const u of payload.users || []) {
          if (u?.userId) map[u.userId] = u.status || "online";
        }
        setPresence(map);
      } catch {}
    };
    const onUpdate = (p = {}) => {
      if (!p?.userId) return;
      setPresence((prev) => ({ ...prev, [p.userId]: p.status || "online" }));
    };
    s.on("presence:snapshot", onSnapshot);
    s.on("presence:update", onUpdate);
    try {
      s.emit("presence:who");
    } catch {}
    return () => {
      try {
        s.off("presence:snapshot", onSnapshot);
        s.off("presence:update", onUpdate);
      } catch {}
    };
  }, [user?.id]);
  // DM other mapping for active conversation
  const dmOtherId = useMemo(() => {
    const gid = active?.id;
    if (!gid) return null;
    const dm = dms.find((d) => d.groupId === gid);
    return dm?.other?.id || null;
  }, [dms, active?.id]);
  // Fallback para identificar o outro participante em DMs quando dms ainda nÃ£o hidratou
  const otherUserId = useMemo(() => {
    if (dmOtherId) return dmOtherId;
    // tenta inferir pelo autor de alguma mensagem que nÃ£o seja minha
    const m = (messages || []).find(
      (x) =>
        (x.author?.id || x.authorId) &&
        (x.author?.id || x.authorId) !== user?.id
    );
    return m ? m.author?.id || m.authorId : null;
  }, [dmOtherId, messages, user?.id]);

  function openDesktopSearch() {
    if (!desktopSearchShown) setDesktopSearchShown(true);
    setDesktopSearchOpen(true);
    setTimeout(() => {
      try {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } catch {}
    }, 0);
  }
  function closeDesktopSearch() {
    setDesktopSearchOpen(false);
    setTimeout(() => setDesktopSearchShown(false), 200);
  }
  function toggleDesktopSearch() {
    if (desktopSearchOpen || desktopSearchShown) closeDesktopSearch();
    else openDesktopSearch();
  }
  function openMobileSearch() {
    if (!mobileSearchShown) setMobileSearchShown(true);
    setMobileSearchOpen(true);
    setTimeout(() => {
      try {
        mobileSearchInputRef.current?.focus();
        mobileSearchInputRef.current?.select();
      } catch {}
    }, 0);
  }
  function closeMobileSearch() {
    setMobileSearchOpen(false);
    setTimeout(() => setMobileSearchShown(false), 200);
  }
  function toggleMobileSearch() {
    if (mobileSearchOpen || mobileSearchShown) closeMobileSearch();
    else openMobileSearch();
  }

  // Load lists (groups, DMs, people)
  useEffect(() => {
    (async () => {
      try {
        const g = await api.get("/groups");
        setGroups(g);
        const dmList = await api.get("/dm");
        setDms(dmList);
        const ppl = await api.get("/users/all");
        setPeople(ppl);
        // restore last active
        const saved = localStorage.getItem("chat_active");
        if (saved) {
          const foundG = g.find((x) => x.id === saved);
          if (foundG) {
            setActive(foundG);
            return;
          }
          const foundDM = dmList.find((x) => x.groupId === saved);
          if (foundDM) {
            setActive({
              id: foundDM.groupId,
              name: foundDM.other?.name || "Direto",
              avatarUrl: foundDM.other?.avatarUrl || undefined,
            });
            return;
          }
        }
        if (g[0]) setActive(g[0]);
      } catch (e) {
        setErr("Falha ao carregar listas");
      }
    })();
  }, []);

  // Join group rooms (badges realtime)
  useEffect(() => {
    const s = ioClient();
    try {
      groups.forEach((g) => s.emit("group:join", g.id));
    } catch {}
  }, [groups]);

  // Join DM rooms (badges realtime)
  useEffect(() => {
    const s = ioClient();
    try {
      dms.forEach((dm) => s.emit("group:join", dm.groupId));
    } catch {}
  }, [dms]);

  // Realtime: DM criada (join automÃ¡tico + atualizar lista de DMs)
  useEffect(() => {
    const s = ioClient();
    const meId = user?.id;
    if (!meId) return;
    const onDmCreated = (payload) => {
      try {
        const { groupId, userA, userB } = payload || {};
        if (!groupId || !userA?.id || !userB?.id) return;
        if (userA.id !== meId && userB.id !== meId) return; // nÃ£o envolve este usuÃ¡rio
        const other = userA.id === meId ? userB : userA;
        // adiciona DM se ainda nÃ£o existir
        setDms((prev) => {
          if ((prev || []).some((d) => d.groupId === groupId)) return prev;
          return [
            { id: groupId, groupId, other, _unread: 0, _lastAt: Date.now() },
            ...(prev || []),
          ];
        });
        // entra na sala para receber mensagens em tempo real
        s.emit("group:join", groupId);
      } catch {}
    };
    s.on("dm:created", onDmCreated);
    return () => s.off("dm:created", onDmCreated);
  }, [user?.id]);

  // Realtime: atualizar lista de pessoas quando usuÃ¡rios forem criados/atualizados/excluÃ­dos
  useEffect(() => {
    const s = ioClient();
    function byName(a, b) {
      return (a?.name || "").localeCompare(b?.name || "", "pt-BR", {
        sensitivity: "base",
      });
    }
    const onCreated = (u) => {
      if (!u?.id || u.id === user?.id) return;
      setPeople((prev) => {
        if ((prev || []).some((p) => p.id === u.id)) return prev;
        const next = [
          ...(prev || []),
          {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            avatarUrl: u.avatarUrl,
          },
        ];
        next.sort(byName);
        return next;
      });
    };
    const onUpdated = (u) => {
      if (!u?.id) return;
      setPeople((prev) => {
        const list = (prev || []).map((p) =>
          p.id === u.id
            ? {
                ...p,
                name: u.name,
                email: u.email,
                phone: u.phone,
                avatarUrl: u.avatarUrl,
              }
            : p
        );
        list.sort(byName);
        return list;
      });
    };
    const onDeleted = ({ id }) => {
      if (!id) return;
      setPeople((prev) => (prev || []).filter((p) => p.id !== id));
    };
    s.on("user:created", onCreated);
    s.on("user:updated", onUpdated);
    s.on("user:deleted", onDeleted);
    return () => {
      s.off("user:created", onCreated);
      s.off("user:updated", onUpdated);
      s.off("user:deleted", onDeleted);
    };
  }, [user?.id]);

  // Hydrate DMs with last activity on initial load/refresh
  useEffect(() => {
    (async () => {
      try {
        const pending = dms.filter(
          (dm) =>
            dm &&
            dm.groupId &&
            (dm._lastAt === undefined ||
              dm._lastAt === null ||
              dm._lastPreview === undefined)
        );
        if (!pending.length) return;
        const updates = {};
        for (const dm of pending) {
          try {
            const list = await api.get(`/messages/${dm.groupId}?take=1`);
            const m = Array.isArray(list) ? list[0] : null;
            const last = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
            const mine = (m?.author?.id || m?.authorId) === user?.id;
            let prev = "";
            if (m) {
              if (m.type === "text") prev = m.content || "";
              else if (m.type === "image" || m.type === "gif") prev = "Imagem";
              else if (m.type === "audio") prev = "Áudio";
              else prev = "Anexo";
              if (mine) prev = `Você: ${prev}`;
            }
            updates[dm.groupId] = { last, prev };
          } catch {}
        }
        if (Object.keys(updates).length) {
          setDms((prev) =>
            prev.map((x) =>
              updates[x.groupId] !== undefined
                ? {
                    ...x,
                    _lastAt: updates[x.groupId].last,
                    _lastPreview: updates[x.groupId].prev,
                  }
                : x
            )
          );
        }
      } catch {}
    })();
  }, [dms]);

  // Open DM with a person, creating if needed
  async function startConversation(otherId) {
    setErr("");
    try {
      const dm = await api.get(`/dm/with/${otherId}`);
      if (dm?.groupId) {
        setDms((prev) => {
          const existing = prev.find((x) => x.groupId === dm.groupId);
          const preservedLast = existing?._lastAt;
          const preservedUnread = existing?._unread || 0;
          const rest = prev.filter((x) => x.groupId !== dm.groupId);
          return [
            {
              id: dm.groupId,
              groupId: dm.groupId,
              other: dm.other,
              _unread: preservedUnread,
              _lastAt: preservedLast,
            },
            ...rest,
          ];
        });
        setActive({
          id: dm.groupId,
          name: dm.other?.name || "Direto",
          avatarUrl: dm.other?.avatarUrl || undefined,
        });
        return;
      }
    } catch {}
    try {
      const dm = await api.post(`/dm/${otherId}`);
      if (dm?.groupId) {
        setDms((prev) => {
          const existing = prev.find((x) => x.groupId === dm.groupId);
          const preservedLast = existing?._lastAt;
          const preservedUnread = existing?._unread || 0;
          const rest = prev.filter((x) => x.groupId !== dm.groupId);
          return [
            {
              id: dm.groupId,
              groupId: dm.groupId,
              other: dm.other,
              _unread: preservedUnread,
              _lastAt: preservedLast,
            },
            ...rest,
          ];
        });
        setActive({
          id: dm.groupId,
          name: dm.other?.name || "Direto",
          avatarUrl: dm.other?.avatarUrl || undefined,
        });
        return;
      }
    } catch (e) {
      setErr(e.message || "Falha ao abrir conversa");
      return;
    }
    setErr("Nao foi possivel iniciar a conversa");
  }

  // Load active messages and wire socket listeners
  useEffect(() => {
    if (!active) return;
    let unsub = () => {};
    (async () => {
      const list = await api.get(`/messages/${active.id}?take=50`);
      setMessages(list.reverse());
      try {
        await api.post(`/messages/${active.id}/read`, {});
      } catch {}
      setGroups((prev) =>
        prev.map((g) => (g.id === active.id ? { ...g, _unread: 0 } : g))
      );
      setDms((prev) =>
        prev.map((d) => (d.groupId === active.id ? { ...d, _unread: 0 } : d))
      );

      const s = ioClient();
      try {
        s.off("message:new");
      } catch {}
      try {
        s.off("message:deleted");
      } catch {}
      s.emit("group:join", active.id);

      const onNew = (msg) => {
        const ts = new Date(msg?.createdAt || Date.now()).getTime();
        const mine = (msg.author?.id || msg.authorId) === user?.id;
        const isActive = msg.groupId === active.id;
        const isMuted =
          !!muted?.[msg.groupId] ||
          (dmOtherByGroupId[msg.groupId]
            ? !!muted?.[dmOtherByGroupId[msg.groupId]]
            : false);
        const shouldNotify = (() => {
          try {
            return (!windowFocused || document.hidden) && !mine;
          } catch {
            return !mine;
          }
        })();
        // If the conversation is open and the message is from the other user,
        // mark as read immediately so the sender sees the read status in realtime
        if (isActive && !mine) {
          try {
            api.post(`/messages/${active.id}/read`, {});
          } catch {}
        }
        if (shouldNotify) {
          try {
            showNotificationFor(msg);
          } catch {}
        }
        if (isActive) {
          setMessages((prev) => {
            if ((prev || []).some((m) => m.id === msg.id)) return prev;
            if (msg.replyTo?.id) {
              return prev
                .map((m) =>
                  m.id === msg.replyTo.id
                    ? {
                        ...m,
                        _count: { replies: (m._count?.replies || 0) + 1 },
                      }
                    : m
                )
                .concat(msg);
            }
            return [...prev, msg];
          });
          // bump activity on active convo
          setGroups((prev) =>
            prev.map((g) => (g.id === active.id ? { ...g, _lastAt: ts } : g))
          );
          setDms((prev) =>
            prev.map((d) =>
              d.groupId === active.id
                ? {
                    ...d,
                    _lastAt: ts,
                    _lastPreview:
                      msg.type === "text"
                        ? msg.content
                        : msg.type === "image" || msg.type === "gif"
                        ? "Imagem"
                        : msg.type === "audio"
                        ? "Áudio"
                        : "Anexo",
                  }
                : d
            )
          );
          try {
            if (!mine && !isMuted) playPing();
          } catch {}
        } else {
          // unread + activity on other convos
          setGroups((prev) =>
            prev.map((g) =>
              g.id === msg.groupId
                ? { ...g, _unread: (g._unread || 0) + 1, _lastAt: ts }
                : g
            )
          );
          setDms((prev) =>
            prev.map((d) =>
              d.groupId === msg.groupId
                ? {
                    ...d,
                    _unread: (d._unread || 0) + 1,
                    _lastAt: ts,
                    _lastPreview:
                      msg.type === "text"
                        ? msg.content
                        : msg.type === "image" || msg.type === "gif"
                        ? "Imagem"
                        : msg.type === "audio"
                        ? "Áudio"
                        : "Anexo",
                  }
                : d
            )
          );
          try {
            if (!mine && !isMuted) playPing();
          } catch {}
        }
      };
      const onUpdated = (msg) => {
        if (msg?.groupId === active.id) {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        }
      };
      const onReads = (payload) => {
        try {
          if (!payload || payload.groupId !== active.id) return;
          const ids = Array.isArray(payload.ids) ? payload.ids : [];
          const uid = payload.userId;
          if (!uid || !ids.length) return;
          setMessages((prev) =>
            prev.map((m) =>
              ids.includes(m.id)
                ? {
                    ...m,
                    reads: (m.reads || []).some((r) => r.userId === uid)
                      ? m.reads || []
                      : [...(m.reads || []), { userId: uid }],
                  }
                : m
            )
          );
        } catch {}
      };
      const onDeleted = (payload) => {
        if (payload.groupId === active.id)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.id ? { ...m, deletedAt: payload.deletedAt } : m
            )
          );
      };
      s.on("message:new", onNew);
      s.on("message:updated", onUpdated);
      s.on("messages:read", onReads);
      s.on("message:deleted", onDeleted);
      unsub = () => {
        setMenuFor(null);
        s.off("message:new", onNew);
        s.off("message:updated", onUpdated);
        s.off("messages:read", onReads);
        s.off("message:deleted", onDeleted);
        s.emit("group:leave", active.id);
      };
    })();
    return () => unsub();
  }, [active?.id]);

  // Persist active id
  useEffect(() => {
    if (active?.id) {
      try {
        localStorage.setItem("chat_active", active.id);
      } catch {}
    }
  }, [active?.id]);

  // Auto scroll on new messages
  useEffect(() => {
    const t = setTimeout(() => {
      if (listRef.current)
        listRef.current.scrollTop = listRef.current.scrollHeight;
      if (bottomRef.current) {
        try {
          bottomRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        } catch {}
      }
    }, 0);
    return () => clearTimeout(t);
  }, [messages, active?.id]);

  async function sendMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    setErr("");
    if (!active) return;
    try {
      const hasText = Boolean((text || "").trim());
      const hasFiles = attachments.length > 0;
      const replyId = replyTo?.id || null;
      if (hasText) {
        const content = text; // preserve user formatting (line breaks, spaces)
        const isUrl = /^(https?:\/\/\S+)/i.test(content);
        const lower = content.toLowerCase();
        const isGif = isUrl && /(\.gif($|\?))/i.test(lower);
        const isImg =
          isUrl && /(\.png|\.jpg|\.jpeg|\.webp|\.bmp|\.svg)($|\?)/i.test(lower);
        const type = isGif ? "gif" : isImg ? "image" : "text";
        const created = await api.post(`/messages/${active.id}`, {
          type,
          content,
          replyToId: replyId,
        });
        setMessages((prev) => {
          if ((prev || []).some((m) => m.id === created.id)) return prev;
          return [...prev, created];
        });
        setText("");
      }
      if (hasFiles) {
        for (const item of attachments) {
          const attachmentFile = item?.file;
          if (!attachmentFile) continue;
          const form = new FormData();
          form.append("file", attachmentFile);
          let kind = "file";
          if (attachmentFile.type?.startsWith("audio")) kind = "audio";
          else if (attachmentFile.type?.startsWith("image")) kind = "image";
          const q = replyId ? `&replyToId=${replyId}` : "";
          const createdUpload = await api.upload(
            `/messages/${active.id}/upload?type=${kind}${q}`,
            form
          );
          setMessages((prev) => {
            if ((prev || []).some((m) => m.id === createdUpload.id))
              return prev;
            return [...prev, createdUpload];
          });
        }
        clearAttachments();
      }
      if (hasText || hasFiles) {
        setReplyTo(null);
      }
    } catch (e) {
      setErr(e.message || "Falha ao enviar mensagem");
    }
  }

  function startReply(m) {
    setReplyTo(m);
  }
  async function deleteMessage(m) {
    if (!confirm("Excluir esta mensagem?")) return;
    try {
      await api.delete(`/messages/${m.id}`);
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, deletedAt: new Date().toISOString() } : x
        )
      );
    } catch (e) {
      setErr(e.message || "Falha ao excluir");
    }
  }

  function goToFirstReply(m) {
    const target = messages.find((x) => x.replyTo?.id === m.id);
    if (target) {
      const el = document.getElementById(`msg-${target.id}`);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {}
        setHighlightId(target.id);
        setTimeout(() => setHighlightId(null), 2000);
      }
    }
  }

  // Compute matches when search or messages change
  useEffect(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) {
      setSearchMatches([]);
      setSearchIndex(-1);
      return;
    }
    const ids = messages
      .filter(
        (m) =>
          m &&
          !m.deletedAt &&
          m.type === "text" &&
          (m.content || "").toLowerCase().includes(q)
      )
      .map((m) => m.id);
    setSearchMatches(ids);
    if (ids.length) {
      setSearchIndex(0);
      const el = document.getElementById(`msg-${ids[0]}`);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {}
      }
      setHighlightId(ids[0]);
      setTimeout(() => setHighlightId(null), 1500);
    } else {
      setSearchIndex(-1);
    }
  }, [searchQuery, messages, active?.id]);

  function jumpToMatch(next = true) {
    if (!searchMatches.length) return;
    let idx = searchIndex;
    if (idx < 0) idx = 0;
    else
      idx =
        (idx + (next ? 1 : -1) + searchMatches.length) % searchMatches.length;
    setSearchIndex(idx);
    const id = searchMatches[idx];
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
    }
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1500);
  }

  // Keyboard shortcuts: Ctrl/Cmd+F to focus search, F3/Ctrl+G to navigate
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag =
        e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        (e.target && e.target.isContentEditable);
      // Ctrl/Cmd + F => focus search input
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        // Open mobile search bar on small screens
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          openMobileSearch();
        } else {
          openDesktopSearch();
        }
        return;
      }
      // F3 or Ctrl/Cmd+G => next/prev match
      if (
        !typing &&
        (e.key === "F3" ||
          ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")))
      ) {
        e.preventDefault();
        jumpToMatch(!e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchMatches, searchIndex]);

  // Close search UIs when clicking outside
  useEffect(() => {
    const onDocDown = (e) => {
      const t = e.target;
      if (desktopSearchOpen || desktopSearchShown) {
        const insideDesktop =
          desktopSearchRef.current && desktopSearchRef.current.contains(t);
        const onToggle =
          desktopSearchToggleRef.current &&
          desktopSearchToggleRef.current.contains(t);
        if (!insideDesktop && !onToggle) closeDesktopSearch();
      }
      if (mobileSearchOpen || mobileSearchShown) {
        const insideMobile =
          mobileSearchBarRef.current && mobileSearchBarRef.current.contains(t);
        const onMobileToggle =
          mobileSearchToggleRef.current &&
          mobileSearchToggleRef.current.contains(t);
        if (!insideMobile && !onMobileToggle) closeMobileSearch();
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [desktopSearchOpen, mobileSearchOpen]);

  // Emoji insert helper
  function insertEmoji(emo) {
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + emo);
      try {
        setRecentEmojis((prev) => {
          const next = [emo, ...(prev || []).filter((x) => x !== emo)].slice(
            0,
            24
          );
          try {
            localStorage.setItem("chat_recent_emojis", JSON.stringify(next));
          } catch {}
          return next;
        });
      } catch {}
      setShowEmoji(false);
      try {
        setEmojiQuery("");
      } catch {}
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emo + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emo.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {}
    });
    try {
      setRecentEmojis((prev) => {
        const nextArr = [emo, ...(prev || []).filter((x) => x !== emo)].slice(
          0,
          24
        );
        try {
          localStorage.setItem("chat_recent_emojis", JSON.stringify(nextArr));
        } catch {}
        return nextArr;
      });
    } catch {}
    setShowEmoji(false);
    try {
      setEmojiQuery("");
    } catch {}
  }

  // Audio recording controls
  async function startRecording() {
    setRecError("");
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mime =
        window.MediaRecorder &&
        MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecRef.current = mr;
      const chunks = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: mime });
          const f = new File([blob], `rec-${Date.now()}.webm`, { type: mime });
          const form = new FormData();
          form.append("file", f);
          if (active?.id)
            await api.upload(`/messages/${active.id}/upload?type=audio`, form);
        } catch (e) {
          setRecError(e.message || "Falha ao salvar Ã¡udio");
        } finally {
          cleanupRecording();
        }
      };
      mr.start();
      setRecording(true);
      setRecTime(0);
      recTimerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch (e) {
      setRecError("Acesso ao microfone negado ou indisponível");
      cleanupRecording();
    }
  }
  function stopRecording() {
    try {
      mediaRecRef.current?.stop();
    } catch {}
  }
  function cleanupRecording() {
    setRecording(false);
    if (recTimerRef.current) {
      try {
        clearInterval(recTimerRef.current);
      } catch {}
      recTimerRef.current = null;
    }
    setRecTime(0);
    try {
      mediaStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    mediaStreamRef.current = null;
    mediaRecRef.current = null;
  }
  useEffect(() => {
    return () => {
      try {
        if (recPreviewUrl) URL.revokeObjectURL(recPreviewUrl);
      } catch {}
    };
  }, [recPreviewUrl]);

  async function sendPendingAudio() {
    if (!recPendingFile || !active?.id) return;
    try {
      const form = new FormData();
      form.append("file", recPendingFile);
      const created = await api.upload(
        `/messages/${active.id}/upload?type=audio`,
        form
      );
      setMessages((prev) =>
        prev.some((m) => m.id === created.id) ? prev : [...prev, created]
      );
      setRecPendingFile(null);
      try {
        if (recPreviewUrl) URL.revokeObjectURL(recPreviewUrl);
      } catch {}
      setRecPreviewUrl("");
    } catch (e) {
      setRecError(e?.message || "Falha ao Enviar áudio");
    }
  }
  function cancelPendingAudio() {
    setRecPendingFile(null);
    try {
      if (recPreviewUrl) URL.revokeObjectURL(recPreviewUrl);
    } catch {}
    setRecPreviewUrl("");
  }

  // Right sidebar logic
  function hydrateProfileEditor(
    source = meProfile,
    { force = false } = {}
  ) {
    const me = source || {};
    if (force || !pfName) setPfName(me?.name || "");
    if (force || !pfPhone) setPfPhone(me?.phone || "");
    if (force || !pfAddress) setPfAddress(me?.address || "");
    if (force || !pfStatus) {
      try {
        const stored = localStorage.getItem("profile_status");
        if (stored !== null) setPfStatus(stored);
        else setPfStatus(me?.status || "");
      } catch {
        setPfStatus(me?.status || "");
      }
    }
  }

  async function hydrateMe(force = false) {
    try {
      setRightLoading(true);
      const me = await api.get("/users/me");
      setMeProfile(me || {});
      hydrateProfileEditor(me, { force });
      setRightErr("");
      setRightMsg("");
    } catch (e) {
      setRightErr("Falha ao carregar perfil");
    } finally {
      setRightLoading(false);
    }
  }
  function openRightProfile() {
    setRightOpen(true);
    // If current active is a DM, open the contact's profile; otherwise open self profile
    const gid = active?.id;
    if (gid) {
      const dm = dms.find((d) => d.groupId === gid);
      if (dm?.other?.id) {
        const full =
          (people || []).find((p) => p.id === dm.other.id) || dm.other;
        setRightMode("contact");
        setContactProfile(full || null);
        // Load shared groups with this contact
        (async () => {
          try {
            setContactLoading(true);
            setContactErr("");
            const list = await api.get(`/users/${dm.other.id}/shared-groups`);
            setContactGroups(Array.isArray(list) ? list : []);
          } catch (e) {
            setContactErr(e?.message || "Falha ao carregar grupos em comum");
            setContactGroups([]);
          } finally {
            setContactLoading(false);
          }
        })();
        setRightTab("perfil");
        setRightLoading(false);
        setRightErr("");
        setRightMsg("");
        return;
      }
      // Group profile
      setRightMode("group");
      setRightTab("perfil");
      setRightLoading(false);
      setRightErr("");
      setRightMsg("");
      (async () => {
        try {
          setGroupLoading(true);
          setGroupErr("");
          const list = await api.get(`/groups/${gid}/participants`);
          setGroupMembers(Array.isArray(list) ? list : []);
        } catch (e) {
          setGroupErr(e?.message || "Falha ao carregar participAções");
          setGroupMembers([]);
        } finally {
          setGroupLoading(false);
        }
      })();
      return;
    }
    setRightMode("self");
    hydrateMe(true);
  }
  async function saveProfile() {
    try {
      setRightErr("");
      setRightMsg("");
      const form = new FormData();
      form.append("name", pfName || "");
      if (pfPhone !== undefined && pfPhone !== null)
        form.append("phone", pfPhone);
      if (pfAddress !== undefined && pfAddress !== null)
        form.append("address", pfAddress);
      if (pfAvatar) form.append("avatar", pfAvatar);
      await api.uploadPatch("/users/me", form);
      try {
        localStorage.setItem("profile_status", pfStatus || "");
      } catch {}
      setRightMsg("Perfil atualizado");
      setPfAvatar(null);
      hydrateMe(true);
    } catch (e) {
      setRightErr(e?.message || "Falha ao salvar perfil");
    }
  }
  async function changePassword() {
    try {
      setRightErr("");
      setRightMsg("");
      if (!pwCurrent || !pwNew) {
        setRightErr("Preencha senha atual e nova");
        return;
      }
      await api.post("/users/me/password", {
        current: pwCurrent,
        password: pwNew,
      });
      setRightMsg("Senha atualizada");
      setPwCurrent("");
      setPwNew("");
    } catch (e) {
      setRightErr(e?.message || "Falha ao alterar senha");
    }
  }

  // Filtered/sorted lists (WhatsApp-like): last activity desc, unread desc, then name
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const filteredGroups = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    let list = q
      ? groups.filter((g) => (g.name || "").toLowerCase().includes(q))
      : groups;
    if (onlyPinned) list = list.filter((g) => !!pinned?.[g.id]);
    if (onlyUnread) list = list.filter((g) => (g._unread || 0) > 0);
    return [...list].sort((a, b) => {
      const pa = pinned?.[a.id] ? 1 : 0;
      const pb = pinned?.[b.id] ? 1 : 0;
      if (pa !== pb) return pb - pa; // pinned first
      const la = a?._lastAt || 0,
        lb = b?._lastAt || 0;
      if (la !== lb) return lb - la;
      const ua = a?._unread || 0,
        ub = b?._unread || 0;
      if (ua !== ub) return ub - ua;
      return (a.name || "").localeCompare(b.name || "", "pt-BR", {
        sensitivity: "base",
      });
    });
  }, [groups, convQuery, pinned, onlyPinned, onlyUnread]);

  // Fast lookup maps for rendering and sorting
  const dmByOtherId = useMemo(() => {
    const map = {};
    (dms || []).forEach((d) => {
      const id = d?.other?.id;
      if (id) map[id] = d;
    });
    return map;
  }, [dms]);
  const peopleIndexById = useMemo(() => {
    const idx = {};
    (people || []).forEach((p, i) => {
      if (p?.id) idx[p.id] = i;
    });
    return idx;
  }, [people]);

  // Active conversation pin context
  const activeIsDM = useMemo(() => {
    const gid = active?.id;
    if (!gid) return false;
    return (dms || []).some((d) => d.groupId === gid);
  }, [active?.id, dms]);
  const activePinKey = useMemo(() => {
    if (!active?.id) return null;
    return activeIsDM ? dmOtherId || otherUserId || null : active.id;
  }, [active?.id, activeIsDM, dmOtherId, otherUserId]);
  const activePinned = !!(activePinKey && pinned?.[activePinKey]);

  const filteredPeople = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    let list = q
      ? people.filter((p) => (p.name || "").toLowerCase().includes(q))
      : people;
    if (onlyPinned) {
      list = list.filter((p) => !!pinned?.[p.id]);
    }
    if (onlyUnread) {
      list = list.filter((p) => {
        const dm = dmByOtherId[p.id];
        return (dm?._unread || 0) > 0;
      });
    }
    return [...list].sort((a, b) => {
      const pa = pinned?.[a.id] ? 1 : 0;
      const pb = pinned?.[b.id] ? 1 : 0;
      if (pa !== pb) return pb - pa; // pinned first
      const da = dmByOtherId[a.id];
      const db = dmByOtherId[b.id];
      const la = da?._lastAt || 0,
        lb = db?._lastAt || 0;
      if (la !== lb) return lb - la;
      const ua = da?._unread || 0,
        ub = db?._unread || 0;
      if (ua !== ub) return ub - ua;
      // preserve original order as final tie-breaker (no alphabetical)
      const ia = peopleIndexById[a.id] ?? 0;
      const ib = peopleIndexById[b.id] ?? 0;
      return ia - ib;
    });
  }, [
    people,
    dms,
    convQuery,
    onlyUnread,
    onlyPinned,
    pinned,
    dmByOtherId,
    peopleIndexById,
  ]);

  // Hydrate Groups with last activity/preview on initial load/refresh (similar to DMs)
  useEffect(() => {
    (async () => {
      try {
        const pending = (groups || []).filter(
          (g) =>
            g &&
            g.id &&
            (g._lastAt === undefined ||
              g._lastAt === null ||
              g._lastPreview === undefined)
        );
        if (!pending.length) return;
        const updates = {};
        for (const g of pending) {
          try {
            const list = await api.get(`/messages/${g.id}?take=1`);
            const m = Array.isArray(list) ? list[0] : null;
            const last = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
            let prev = "";
            if (m) {
              if (m.type === "text") prev = m.content || "";
              else if (m.type === "image" || m.type === "gif") prev = "Imagem";
              else if (m.type === "audio") prev = "Áudio";
              else prev = "Anexo";
              const mine = (m?.author?.id || m?.authorId) === user?.id;
              if (mine) prev = `Você: ${prev}`;
            }
            updates[g.id] = { last, prev };
          } catch {}
        }
        if (Object.keys(updates).length) {
          setGroups((prev) =>
            (prev || []).map((x) =>
              updates[x.id] !== undefined
                ? {
                    ...x,
                    _lastAt: updates[x.id].last,
                    _lastPreview: updates[x.id].prev,
                  }
                : x
            )
          );
        }
      } catch {}
    })();
  }, [groups]);

  return (
    <div className="relative flex h-full min-h-full w-full">
      {pushError && (
        <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded bg-amber-100 px-4 py-2 text-sm text-amber-800 shadow">
          {pushError}
        </div>
      )}
      <aside className="w-72 xl:w-80 flex-shrink-0 flex flex-col border-r border-slate-200/80 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
        <div className="px-3 py-2 border-b border-slate-200">
          <input
            value={convQuery}
            onChange={(e) => setConvQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border hover:bg-slate-50"
              onClick={() => {
                try {
                  document
                    .getElementById("people-list")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                } catch {}
              }}
            >
              Nova conversa
            </button>
            <label className="text-xs inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyPinned}
                onChange={(e) => setOnlyPinned(e.target.checked)}
              />{" "}
              Fixadas
            </label>
            <label className="text-xs inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />{" "}
              Não lidas
            </label>
          </div>
        </div>
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200">
          Grupos
        </div>
        {filteredGroups.map((g) => {
          const lastAt = g?._lastAt || 0;
          const lastLabel = lastAt
            ? new Date(lastAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          const preview = g?._lastPreview || "";
          const isPinned = !!pinned?.[g.id];
          const isMuted = !!muted?.[g.id];
          return (
            <button
              key={g.id}
              onClick={() => setActive(g)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSideMenu({
                  open: true,
                  type: "group",
                  id: g.id,
                  groupId: g.id,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              className={`px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 border ${
                active?.id === g.id
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  : "border-transparent hover:border-slate-200 dark:border-transparent dark:hover:border-slate-600"
              } flex items-center justify-between transition-colors`}
              title={g.name || ""}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-left" title={g.name || ""}>
                    {g.name}
                  </span>
                  {lastLabel && (
                    <span className="text-[11px] text-slate-500">
                      {lastLabel}
                    </span>
                  )}
                </div>
                {preview && (
                  <div
                    className="text-slate-500 truncate max-w-[220px] text-xs"
                    title={preview}
                  >
                    {preview}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {g._unread > 0 && (
                  <span className="ml-2 min-w-[22px] h-5 px-1.5 rounded-full bg-blue-600/90 text-white text-[11px] inline-flex items-center justify-center shadow">
                    {g._unread}
                  </span>
                )}
              </div>
            </button>
          );
        })}
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 border-t border-slate-200 sticky top-0 z-10 bg-white dark:bg-slate-800">
          Pessoas
        </div>
        <div id="people-list" className="px-3 py-2 flex flex-col gap-1">
          {filteredPeople.map((p) => {
            const dmInfo = dmByOtherId[p.id] || null;
            const unread = dmInfo?._unread || 0;
            const lastAt = dmInfo?._lastAt || 0;
            const lastLabel = lastAt
              ? new Date(lastAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const preview = dmInfo?._lastPreview || "";
            const isPinned = !!pinned?.[p.id];
            const isSelected = !!(
              active?.id &&
              dmInfo?.groupId &&
              active.id === dmInfo.groupId
            );
            return (
              <button
                key={p.id}
                onClick={() => startConversation(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSideMenu({
                    open: true,
                    type: "user",
                    id: p.id,
                    groupId: dmInfo?.groupId || null,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                className={`rounded-lg px-2 py-2 flex items-center justify-between gap-2 border transition-colors ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/60 border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Avatar
                    url={p.avatarUrl}
                    name={p.name}
                    size={40}
                    status={presence[p.id] || p.status}
                    showStatus={true}
                  />
                  <span className="flex flex-col items-start min-w-0">
                    <span
                      className="truncate font-medium text-sm"
                      title={p.name || ""}
                    >
                      {p.name}
                    </span>
                    {p.status && (
                      <span
                        className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full border ${
                          String(p.status).toLowerCase() === "online"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    )}
                    {preview && (
                      <span
                        className="truncate text-xs text-slate-500 max-w-[180px]"
                        title={preview}
                      >
                        {preview}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {lastLabel && (
                    <span className="text-[11px] text-slate-500">
                      {lastLabel}
                    </span>
                  )}
                  {unread > 0 && (
                    <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-blue-600/90 text-white text-[11px] inline-flex items-center justify-center shadow">
                      {unread}
                    </span>
                  )}
                  {/* Pin removido para reduzir poluiÃ§Ã£o visual */}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      {/* Sidebar context menu */}
      {sideMenu?.open && (
        <div
          ref={sideMenuRef}
          className="fixed z-50 w-48 bg-white border border-slate-200 rounded shadow"
          style={{
            top: Math.max(8, sideMenu.y),
            left: Math.max(8, sideMenu.x),
          }}
          role="menu"
        >
          {sideMenu.type === "user" && (
            <>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (sideMenu?.id) togglePin(sideMenu.id);
                  setSideMenu((s) => ({ ...s, open: false }));
                }}
              >
                {pinned?.[sideMenu.id] ? "Desafixar" : "Fixar"}
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  const key = sideMenu.groupId || sideMenu.id;
                  if (key) toggleMute(key);
                  setSideMenu((s) => ({ ...s, open: false }));
                }}
              >
                {(() => {
                  const key = sideMenu.groupId || sideMenu.id;
                  return muted?.[key] ? "Reativar som" : "Silenciar";
                })()}
              </button>
            </>
          )}
          {sideMenu.type === "group" && (
            <>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (sideMenu?.id) togglePin(sideMenu.id);
                  setSideMenu((s) => ({ ...s, open: false }));
                }}
              >
                {pinned?.[sideMenu.id] ? "Desafixar" : "Fixar"}
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  if (sideMenu?.id) toggleMute(sideMenu.id);
                  setSideMenu((s) => ({ ...s, open: false }));
                }}
              >
                {muted?.[sideMenu.id] ? "Reativar som" : "Silenciar"}
              </button>
            </>
          )}
        </div>
      )}
      {/* Conversation area */}
      <div className="relative flex-1 flex min-h-0 flex-col chat-bg">
        <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 bg-gradient-to-r from-white/80 to-slate-50/80 dark:from-slate-900/60 dark:to-slate-800/60 backdrop-blur font-medium flex items-center gap-2 shadow-sm">
          <button
            type="button"
            className="flex items-center gap-3 min-w-0 truncate text-left hover:underline"
            onClick={() => openRightProfile()}
            title="Abrir perfil"
          >
            <Avatar
              url={active?.avatarUrl}
              name={active?.name || "Selecione um grupo"}
              size={36}
            />
            {/* Nome removido conforme solicitado */}
          </button>
          <div className="ml-auto flex items-center gap-1 relative">
            {/* Mobile search toggle */}
            <button
              ref={mobileSearchToggleRef}
              type="button"
              className="md:hidden px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              title="Buscar"
              aria-label="Buscar"
              onClick={toggleMobileSearch}
            >
              <IconSearch />
            </button>
            {/* Desktop search toggle */}
            <button
              ref={desktopSearchToggleRef}
              type="button"
              className="hidden md:inline-flex px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              title="Buscar"
              aria-label="Buscar"
              onClick={toggleDesktopSearch}
            >
              <IconSearch />
            </button>
            {desktopSearchShown && (
              <div
                ref={desktopSearchRef}
                className={`hidden md:flex items-center gap-1 transition-all duration-200 ease-out ${
                  desktopSearchOpen
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mensagens..."
                  className="border rounded px-2 py-1 text-sm w-56"
                  aria-label="Buscar mensagens"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      jumpToMatch(!e.shiftKey);
                    }
                  }}
                />
                {searchQuery && (
                  <span className="items-center text-[11px] text-slate-500 px-1">
                    {searchMatches.length
                      ? `${searchIndex + 1}/${searchMatches.length}`
                      : "0/0"}
                  </span>
                )}
                <div className="flex items-center">
                  <button
                    type="button"
                    className="px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    title="Anterior"
                    onClick={() => jumpToMatch(false)}
                  >
                    <IconChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    title="Próximo"
                    onClick={() => jumpToMatch(true)}
                  >
                    <IconChevronRight />
                  </button>
                  {searchQuery && (
                    <button
                      type="button"
                      className="px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
                      title="Limpar"
                      onClick={() => setSearchQuery("")}
                    >
                      <IconX />
                    </button>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              title="Mais opções"
              aria-haspopup="menu"
              aria-expanded={convMenuOpen}
              onClick={() => setConvMenuOpen((v) => !v)}
            >
              <IconEllipsis />
            </button>
            {convMenuOpen && (
              <div
                ref={convMenuRef}
                className="absolute right-0 top-10 z-20 w-48 bg-white border border-slate-200 rounded shadow"
                role="menu"
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => {
                    if (activePinKey) togglePin(activePinKey);
                    setConvMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  {activePinned ? "Desafixar conversa" : "Fixar conversa"}
                </button>
              </div>
            )}
          </div>
        </div>
        {!active && (
          <div className="flex-1 grid place-items-center p-6">
            <div className="text-center text-slate-600 dark:text-slate-300">
              <div className="mx-auto dark:bg-slate-700 grid place-items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-8 h-8 text-slate-400 dark:text-slate-300"
                >
                  <path d="M19.5 6.75v10.5A2.25 2.25 0 0 1 17.25 19.5H6.75A2.25 2.25 0 0 1 4.5 17.25V6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75ZM8.25 9A.75.75 0 0 0 7.5 9.75v6a.75.75 0 0 0 1.5 0v-6A.75.75 0 0 0 8.25 9Zm4.5 0a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6A.75.75 0 0 0 12.75 9Zm4.5.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z" />
                </svg>
              </div>
              <div className="text-lg font-semibold">
                Selecione uma conversa
              </div>
              <div className="text-sm">
                {"Escolha um grupo ou contato \u00E0 esquerda."}
              </div>
            </div>
          </div>
        )}

        {/* Mobile search bar */}
        {mobileSearchShown && (
          <div
            ref={mobileSearchBarRef}
            className={`md:hidden px-3 py-2 border-b border-slate-200 bg-white flex items-center gap-2 transition-all duration-200 ease-out ${
              mobileSearchOpen
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-1 pointer-events-none"
            }`}
          >
            <input
              ref={mobileSearchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar mensagens..."
              className="flex-1 border rounded px-2 py-1 text-sm"
              aria-label="Buscar mensagens"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  jumpToMatch(!e.shiftKey);
                }
              }}
            />
            <span className="text-[11px] text-slate-500 px-1">
              {searchMatches.length
                ? `${searchIndex + 1}/${searchMatches.length}`
                : "0/0"}
            </span>
            <button
              type="button"
              className="px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
              title="Anterior"
              onClick={() => jumpToMatch(false)}
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              className="px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
              title="Próximo"
              onClick={() => jumpToMatch(true)}
            >
              <IconChevronRight />
            </button>
            {searchQuery && (
              <button
                type="button"
                className="px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
                title="Limpar"
                onClick={() => setSearchQuery("")}
              >
                <IconX />
              </button>
            )}
          </div>
        )}


        <div
          ref={listRef}
          className={`flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 ${
            !active ? "hidden" : ""
          }`}
        >
          {messages.map((m, i) => {
            const mine = (m.author?.id || m.authorId) === user?.id;
            const bubbleClass = mine
              ? "max-w-[75%] bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-md shadow-md"
              : "max-w-[75%] bg-white text-slate-800 px-4 py-2.5 rounded-2xl rounded-tl-md shadow-md border border-slate-200/60";
            const lineClass = mine
              ? "flex justify-end mb-2 items-end"
              : "flex justify-start mb-2 items-end";
            const prev = messages[i - 1];
            const showDate =
              !prev ||
              new Date(prev.createdAt).toDateString() !==
                new Date(m.createdAt).toDateString();
            const dateLabel = (() => {
              const date = new Date(m.createdAt);
              const now = new Date();
              const start = (d) =>
                new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const diff = (start(date) - start(now)) / 86400000;
              if (diff === 0) return "Hoje";
              if (diff === -1) return "Ontem";
              return date.toLocaleDateString("pt-BR");
            })();
            return (
              <div key={m.id} id={`msg-${m.id}`} className="w-full">
                {showDate && (
                  <div className="max-w-32 mx-auto rounded-full text-center text-xs bg-sky-600  text-slate-100 my-2">
                    {dateLabel}
                  </div>
                )}
                <div className={`${lineClass} group`}>
                  {!mine && (
                    <div className="mr-2">
                      <Avatar
                        url={m.author?.avatarUrl}
                        name={m.author?.name}
                        size={32}
                      />
                    </div>
                  )}
                  <div
                    className={`${bubbleClass} ${
                      highlightId === m.id ? "ring-2 ring-yellow-400" : ""
                    } ${
                      searchQuery &&
                      m.type === "text" &&
                      (m.content || "")
                        .toLowerCase()
                        .includes((searchQuery || "").toLowerCase())
                        ? "outline outline-2 outline-yellow-300"
                        : ""
                    }`}
                  >
                    {!mine && (
                      <div className="mb-1 text-xs font-semibold text-slate-600">
                        {m.author?.name || "Contato"}
                      </div>
                    )}
                    {m.replyTo && (
                      <div className="mb-1 pl-2 border-l-4 border-blue-400 text-xs text-slate-600">
                        <div className="font-medium">
                          {m.replyTo.author?.name || "Mensagem"}
                        </div>
                        <div className="truncate opacity-90">
                          {m.replyTo.type === "text"
                            ? m.replyTo.content
                            : m.replyTo.type === "image"
                            ? "Imagem"
                            : m.replyTo.type === "audio"
                            ? "Áudio"
                            : "Anexo"}
                        </div>
                      </div>
                    )}
                    {m.deletedAt ? (
                      <div className="italic opacity-70">Mensagem apagada</div>
                    ) : m.type === "text" ? (
                      <MessageText
                        message={m}
                        mine={mine}
                        onStartEdit={(msg) => {
                          setEditId(msg.id);
                          setEditText(msg.content || "");
                          setMenuFor(null);
                        }}
                        onSave={async (msg, value) => {
                          try {
                            const updated = await api.patch(
                              `/messages/${msg.id}`,
                              { content: value.trim() }
                            );
                            setMessages((prev) =>
                              prev.map((x) => (x.id === msg.id ? updated : x))
                            );
                            setEditId("");
                            setEditText("");
                          } catch (e) {
                            setErr(e?.message || "Falha ao editar");
                          }
                        }}
                        onCancel={() => {
                          setEditId("");
                          setEditText("");
                        }}
                        editingId={editId}
                        editText={editText}
                        setEditText={setEditText}
                      />
                    ) : m.type === "image" || m.type === "gif" ? (
                      (() => {
                        const imageUrl = absUrl(m.content);
                        const imageName =
                          fileNameFromUrl(m.content) || "imagem";
                        return (
                          <div className="flex flex-col gap-2 items-start">
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block max-w-[220px]"
                            >
                              <img
                                src={imageUrl}
                                alt={imageName}
                                className="max-w-full max-h-60 rounded shadow-sm object-contain bg-slate-100"
                              />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                downloadAttachment(imageUrl, imageName)
                              }
                              className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 transition"
                            >
                              Baixar
                            </button>
                          </div>
                        );
                      })()
                    ) : m.type === "audio" ? (
                      <audio
                        src={absUrl(m.content)}
                        controls
                        className="w-60"
                      />
                    ) : (
                      <a
                        className="underline break-all"
                        href={absUrl(m.content)}
                        target="_blank"
                        rel="noreferrer"
                        title={fileNameFromUrl(m.content) || "Abrir anexo"}
                      >
                        {fileNameFromUrl(m.content) || "Abrir anexo"}
                      </a>
                    )}
                    <div className="mt-1 text-[10px] opacity-80 flex items-center gap-2">
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine &&
                        (() => {
                          // Determine status and tooltip
                          const readers = (m.reads || []).map((r) => r.userId);
                          if (otherUserId) {
                            const isRead = readers.includes(otherUserId);
                            const title = isRead ? "Visualizada" : "Entregue";
                            return <StatusTicks read={isRead} title={title} />;
                          }
                          // Grupo: azul quando hÃ¡ pelo menos um leitor (aproximaÃ§Ã£o visual)
                          const readerIds = readers.filter(
                            (uid) => uid && uid !== user?.id
                          );
                          if (readerIds.length === 0)
                            return (
                              <StatusTicks read={false} title="Entregue" />
                            );
                          const names = readerIds
                            .map(
                              (uid) =>
                                (people || []).find((p) => p.id === uid)
                                  ?.name || ""
                            )
                            .filter(Boolean);
                          const title = names.length
                            ? names.join(", ")
                            : `Visto por ${readerIds.length}`;
                          return <StatusTicks read={true} title={title} />;
                        })()}
                      <button
                        type="button"
                        title={isFav(m.id) ? "Remover favorito" : "Favoritar"}
                        onClick={() => toggleFav(m)}
                        className={`${
                          isFav(m.id)
                            ? "text-yellow-400"
                            : "text-slate-300 hover:text-slate-500"
                        } transition-colors`}
                      >
                        <IconStar className="w-4 h-4" filled={isFav(m.id)} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="ml-1 relative"
                    ref={menuFor === m.id ? setMessageMenuContainer : null}
                  >
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-700"
                      onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      aria-label="AÃ§Ãµes"
                    >
                      ...
                    </button>
                    {menuFor === m.id && (
                      <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded shadow text-sm z-10">
                        <button
                          className="block w-full text-left px-3 py-1.5 hover:bg-slate-50"
                          onClick={() => {
                            setMenuFor(null);
                            startReply(m);
                          }}
                        >
                          Responder
                        </button>
                        {(m.author?.id || m.authorId) === user?.id &&
                          m.type === "text" &&
                          !m.deletedAt && (
                            <button
                              className="block w-full text-left px-3 py-1.5 hover:bg-slate-50"
                              onClick={() => {
                                setEditId(m.id);
                                setEditText(m.content || "");
                                setMenuFor(null);
                              }}
                            >
                              Editar
                            </button>
                          )}
                        <button
                          className="block w-full text-left px-3 py-1.5 hover:bg-slate-50"
                          onClick={() => {
                            setMenuFor(null);
                            toggleFav(m);
                          }}
                        >
                          Favoritar
                        </button>
                        {(m.author?.id || m.authorId) === user?.id && (
                          <button
                            className="block w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setMenuFor(null);
                              deleteMessage(m);
                            }}
                          >
                            Apagar
                          </button>
                        )}
                        {m._count?.replies > 0 && (
                          <button
                            className="block w-full text-left px-3 py-1.5 hover:bg-slate-50"
                            onClick={() => {
                              setMenuFor(null);
                              goToFirstReply(m);
                            }}
                          >
                            Ir para respostas
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {replyTo && (
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-start gap-2">
            <div className="border-l-4 border-blue-500 pl-2 text-sm text-slate-700 flex-1">
              <div className="font-medium">
                Respondendo {replyTo.author?.name || "mensagem"}
              </div>
              <div className="truncate">
                {replyTo.type === "text"
                  ? replyTo.content
                  : replyTo.type === "image"
                  ? "Imagem"
                  : replyTo.type === "audio"
                  ? "Áudio"
                  : "Anexo"}
              </div>
            </div>
            <button
              className="text-slate-500 hover:text-slate-700"
              onClick={() => setReplyTo(null)}
            >
              Cancelar
            </button>
          </div>
        )}

        {recPendingFile && (
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
            <audio src={recPreviewUrl} controls className="w-64" />
            <div className="text-xs text-slate-600">PrÃ©-escuta do Ã¡udio</div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={sendPendingAudio}
              >
                Enviar áudio
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100"
                onClick={cancelPendingAudio}
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-200 bg-white dark:bg-slate-900 flex flex-wrap gap-3 flex-wrap">
            {attachments.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50"
              >
                {item.preview ? (
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-16 h-16 object-cover rounded border border-slate-200 dark:border-slate-600"
                  />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-100 dark:bg-slate-700/40 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                    {item.file.type?.startsWith("audio")
                      ? "Áudio"
                      : item.file.type?.startsWith("Vídeo")
                      ? "Vídeo"
                      : item.file.type?.includes("pdf")
                      ? "PDF"
                      : "Arquivo"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {((item.file.size || 0) / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
                <button
                  type="button"
                  className="text-slate-500 hover:text-red-600 text-sm"
                  onClick={() => removeAttachment(item.id)}
                  aria-label={`Remover anexo ${item.file.name}`}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          ref={composerRef} onSubmit={sendMessage}
          className={`chat-composer relative flex flex-col gap-2 p-3 border-t border-slate-200/70 bg-white/90 dark:bg-slate-900/70 backdrop-blur ${
            !active ? "hidden" : ""
          }`}
        >
          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              ref={emojiBtnRef} onClick={() => (showEmoji ? setShowEmoji(false) : openEmojiPopover())}
              title="Emojis"
              className="flex-shrink-0 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
              aria-label="Emojis"
            >
              <IconEmoji className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                } catch {}
                fileInputRef.current?.click();
              }}
              title="Anexar"
              className="inline-flex shrink-0 items-center justify-center p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
              aria-label="Anexar"
              style={{ fontSize: 0 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M21.44 11.05l-9.19 9.19a5 5 0 11-7.07-7.07l9.19-9.19a3 3 0 114.24 4.24l-9.19 9.19a1 1 0 11-1.41-1.41l8.49-8.49" />
              </svg>
              <span className="sr-only">Anexar arquivo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                addAttachments(selected);
              }}
              className="hidden"
            />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.altKey &&
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.isComposing
                ) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onPaste={(e) => {
                try {
                  const items = e.clipboardData?.items || [];
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (
                      it &&
                      typeof it.type === "string" &&
                      it.type.startsWith("image/")
                    ) {
                      const blob = it.getAsFile();
                      if (blob) {
                        const fname = `paste-${Date.now()}.${(
                          blob.type.split("/")[1] || "png"
                        ).replace(/[^a-z0-9]/gi, "")}`;
                        const f = new File([blob], fname, {
                          type: blob.type || "image/png",
                        });
                        addAttachments([f]);
                        e.preventDefault();
                        break;
                      }
                    }
                  }
                } catch {}
              }}
              placeholder="Digite sua mensagem... (Enter envia, Shift+Enter quebra linha)"
              rows={1}
              className="flex-1 min-w-0 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 resize-y min-h-[40px]"
            />
            <button
              type="button"
              onClick={() => {
                if ((text || "").trim() || attachments.length) {
                  sendMessage();
                } else {
                  recording ? stopRecording() : startRecording();
                }
              }}
              className={`${
                (text || "").trim() || attachments.length
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow"
                  : recording
                  ? "bg-red-600 text-white hover:bg-red-700 shadow"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 shadow"
              } inline-flex items-center justify-center rounded-full w-10 h-10 flex-shrink-0`}
              title={
                (text || "").trim() || attachments.length
                  ? "Enviar"
                  : recording
                  ? "Parar gravação"
                  : "Gravar áudio"
              }
            >
              {(text || "").trim() || attachments.length ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M2.31 20.87 22 12 2.31 3.13a.75.75 0 0 0-.98.97L4.7 11.1c.1.25.1.53 0 .78l-3.37 7a.75.75 0 0 0 .98.98Z" />
                </svg>
              ) : recording ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 1 0-7 0v4a3.5 3.5 0 0 0 3.5 3.5Zm5-3.5a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20h2v-2.08A7 7 0 0 0 19 11h-2Z" />
                </svg>
              )}
            </button>
          </div>
          {recording && (
            <span
              className="text-xs text-red-600 inline-flex items-center gap-1"
              aria-live="polite"
            >
              <span className="inline-block w-2 h-2 bg-red-600 rounded-full" />{" "}
              {recTime}s
            </span>
          )}
          {err && <div className="text-sm text-red-600">{err}</div>}
          {recError && <div className="text-sm text-red-600">{recError}</div>}

          {showEmoji && (
            <div className="fixed mb-2 bg-white border border-slate-200 rounded-md p-2 shadow z-50 overflow-y-auto overflow-x-hidden" style={{ left: Math.max(4, emojiPos.left), bottom: Math.max(4, emojiPos.bottom || 0), width: `${emojiPos.width || 360}px`, maxHeight: `${emojiPos.maxHeight || 416}px` }}>
              <button
                type="button"
                className="absolute top-2 right-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60"
                aria-label="Fechar"
                onClick={() => setShowEmoji(false)}
                title="Fechar"
              >
                <IconX className="w-4 h-4" />
              </button>
              {/* Campo de busca removido: navegação somente por rolagem */}
              {/* Atalhos removidos: navegação apenas por rolagem */}
              {false && (
                  <>
                    <div
                      ref={setEmojiSectionRef("recent")}
                      className="sticky top-0 bg-white text-[11px] text-slate-500 mb-1"
                    >
                      Recentes
                    </div>
                    <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 gap-1 mb-2">
                      {recentEmojis.map((e) => (
                        <button
                          key={`r-${e}`}
                          type="button"
                          onClick={() => insertEmoji(e)}
                          onContextMenu={(ev) => {
                            ev.preventDefault();
                            toggleFavEmoji(e);
                          }}
                          className={`relative inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 text-2xl leading-none hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded px-1.5 ${
                            (favoriteEmojis || []).includes(e)
                              ? "bg-yellow-50"
                              : ""
                          }`}
                        >
                          {(favoriteEmojis || []).includes(e) && (
                            <span className="absolute -top-0.5 -left-0.5 text-[10px] text-yellow-600">
                              ★
                            </span>
                          )}
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              {false && (
                  <>
                    <div
                      ref={setEmojiSectionRef("favoritos")}
                      className="sticky top-0 bg-white text-[11px] text-slate-500 mb-1"
                    >
                      Favoritos
                    </div>
                    <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 gap-1 mb-2">
                      {(favoriteEmojis || []).map((e) => (
                        <button
                          key={`f-${e}`}
                          type="button"
                          onClick={() => insertEmoji(e)}
                          onContextMenu={(ev) => {
                            ev.preventDefault();
                            toggleFavEmoji(e);
                          }}
                          className="relative inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 text-2xl leading-none hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded px-1.5 bg-yellow-50"
                        >
                          <span className="absolute -top-0.5 -left-0.5 text-[10px] text-yellow-600">
                            ★
                          </span>
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              {false ? (
                <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 gap-1">
                  {EMOJIS.filter((e) => e.includes(emojiQuery.trim())).map(
                    (e) => (
                      <button
                        key={`s-${e}`}
                        type="button"
                        onClick={() => insertEmoji(e)}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          toggleFavEmoji(e);
                        }}
                        className={`relative inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 text-2xl leading-none hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded px-1.5 ${
                          (favoriteEmojis || []).includes(e)
                            ? "bg-yellow-50"
                            : ""
                        }`}
                      >
                        {(favoriteEmojis || []).includes(e) && (
                          <span className="absolute -top-0.5 -left-0.5 text-[10px] text-yellow-600">
                            ★
                          </span>
                        )}
                        {e}
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div
                  ref={emojiScrollRef}
                  className="relative max-h-80 overflow-y-auto overflow-x-hidden pr-1"
                >
                  {emojiOrder
                    .filter((k) => k !== "recent" || recentEmojis.length > 0)
                    .filter(
                      (k) =>
                        k !== "favoritos" || (favoriteEmojis || []).length > 0
                    )
                    .filter((k) =>
                      k !== "recent" && k !== "favoritos"
                        ? (EMOJI_CATS[k] || []).length > 0
                        : true
                    )
                    .map((key) => (
                      <div key={`sec-${key}`}>
                        <div
                          ref={setEmojiSectionRef(key)}
                          className="sticky top-0 bg-white text-[11px] text-slate-500 mb-1 mt-1"
                        >
                          {key === "recent"
                            ? "Recentes"
                            : key === "favoritos"
                            ? "Favoritos"
                            : EMOJI_TABS.find((t) => t.key === key)?.label ||
                              key}
                        </div>
                        <div className="grid grid-cols-7 sm:grid-cols-8 md:grid-cols-10 gap-1 mb-2">
                          {(key === "recent"
                            ? recentEmojis
                            : key === "favoritos"
                            ? favoriteEmojis || []
                            : EMOJI_CATS[key] || []
                          ).map((e) => (
                            <button
                              key={`sec-${key}-${e}`}
                              type="button"
                              onClick={() => insertEmoji(e)}
                              onContextMenu={(ev) => {
                                ev.preventDefault();
                                toggleFavEmoji(e);
                              }}
                              className={`relative inline-flex items-center justify-center w-8 h-8 md:w-9 md:h-9 text-2xl leading-none hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded px-1.5 ${
                                (favoriteEmojis || []).includes(e)
                                  ? "bg-yellow-50"
                                  : ""
                              }`}
                            >
                              {(favoriteEmojis || []).includes(e) && (
                                <span className="absolute -top-0.5 -left-0.5 text-[10px] text-yellow-600">
                                  ★
                                </span>
                              )}
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {emojiTab === "recent" && recentEmojis.length === 0 && (
                <div className="text-xs text-slate-500 mt-2">
                  Sem recentes ainda
                </div>
              )}
            </div>
          )}
        </form>
      </div>
      {rightOpen && (
        <aside className="w-[360px] max-w-sm flex-shrink-0 border-l border-slate-200 bg-white/90 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold">Detalhes</div>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              aria-label="Fechar detalhes"
              onClick={() => setRightOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="px-4 pt-2 border-b border-slate-200">
            <div className="inline-flex items-center gap-2 text-sm">
            <button
              className={`px-3 py-2 ${
                rightTab === "perfil"
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-600 hover:text-slate-800"
              }`}
              onClick={() => setRightTab("perfil")}
            >
              Perfil
            </button>
            <button
              className={`px-3 py-2 ${
                rightTab === "arquivos"
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-600 hover:text-slate-800"
              }`}
              onClick={() => setRightTab("arquivos")}
            >
              Arquivos
            </button>
            <button
              className={`px-3 py-2 ${
                rightTab === "favoritos"
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-600 hover:text-slate-800"
              }`}
              onClick={() => setRightTab("favoritos")}
            >
              Favoritos
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4 overflow-auto flex-1">
          {rightLoading ? (
            <div className="text-sm text-slate-500">Carregando...</div>
          ) : (
            <>
              {rightTab === "perfil" && (
                <>
                  {rightMode === "contact" ? (
                    <>
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                          {contactProfile?.avatarUrl ? (
                            <img
                              src={absUrl(contactProfile.avatarUrl)}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500 text-sm">
                              Sem foto
                            </span>
                          )}
                        </div>
                        <div className="w-full">
                          <div className="text-center font-semibold truncate">
                            {contactProfile?.name || "Contato"}
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            {contactProfile?.email && (
                              <div className="px-3 py-1 rounded bg-slate-50 border border-slate-200 truncate text-center">
                                {contactProfile.email}
                              </div>
                            )}
                            {contactProfile?.phone && (
                              <div className="px-3 py-1 rounded bg-slate-50 border border-slate-200 truncate text-center">
                                {contactProfile.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-center gap-2">
                        {contactProfile?.phone && (
                          <button
                            type="button"
                            className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50"
                            onClick={() => {
                              const params = new URLSearchParams();
                              if (contactProfile.phone)
                                params.set("to", contactProfile.phone);
                              if (contactProfile.name)
                                params.set("name", contactProfile.name);
                              if (contactProfile.id)
                                params.set("id", contactProfile.id);
                              nav(`/telefonia?${params.toString()}`);
                            }}
                          >
                            Ligar
                          </button>
                        )}
                        <button
                          type="button"
                          className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50"
                          onClick={() => setRightTab("arquivos")}
                        >
                          Ver arquivos
                        </button>
                      </div>
                      <div className="mt-5">
                        <div className="font-semibold mb-2">
                          Grupos em comum
                        </div>
                        {contactLoading ? (
                          <div className="text-sm text-slate-500">
                            Carregando...
                          </div>
                        ) : contactErr ? (
                          <div className="text-sm text-red-600">
                            {contactErr}
                          </div>
                        ) : contactGroups.filter(
                            (g) => (g?.name || "").toUpperCase() !== "DM"
                          ).length > 0 ? (
                          <ul className="space-y-1">
                            {contactGroups
                              .filter(
                                (g) =>
                                  (g?.name || "").toUpperCase() !== "DM"
                              )
                              .map((g) => (
                                <li key={g.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                                    onClick={() => {
                                      setActive({ id: g.id, name: g.name });
                                    }}
                                  >
                                    {g.name}
                                  </button>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-slate-500">
                            Nenhum grupo em comum.
                          </div>
                        )}
                      </div>
                    </>
                  ) : rightMode === "group" ? (
                    <>
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                          {active?.avatarUrl ? (
                            <img
                              src={absUrl(active.avatarUrl)}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500 text-sm">
                              Grupo
                            </span>
                          )}
                        </div>
                        <div className="w-full">
                          <div className="text-center font-semibold truncate">
                            {active?.name || "Grupo"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-5">
                        <div className="font-semibold mb-2">
                          Participantes
                        </div>
                        {groupLoading ? (
                          <div className="text-sm text-slate-500">
                            Carregando...
                          </div>
                        ) : groupErr ? (
                          <div className="text-sm text-red-600">
                            {groupErr}
                          </div>
                        ) : groupMembers.length > 0 ? (
                          <ul className="space-y-1">
                            {groupMembers.map((m) => (
                              <li
                                key={m.id}
                                className="flex items-center gap-2 px-2 py-1 rounded border border-slate-200"
                              >
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0">
                                  {m.user?.avatarUrl ? (
                                    <img
                                      src={absUrl(m.user.avatarUrl)}
                                      alt={m.user?.name || "participante"}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-500">
                                      {(m.user?.name || "?")
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {m.user?.name || "Participante"}
                                  </div>
                                  {m.user?.email && (
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {m.user.email}
                                    </div>
                                  )}
                                </div>
                                {m.role && (
                                  <span className="text-[11px] text-slate-500 ml-2">
                                    {m.role}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-slate-500">
                            Nenhum participante.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                          {pfAvatar ? (
                            <img
                              src={URL.createObjectURL(pfAvatar)}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : meProfile?.avatarUrl ? (
                            <img
                              src={absUrl(meProfile.avatarUrl)}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500">Sem foto</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-slate-600">
                            Foto de perfil
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id="pfAvatar"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                setPfAvatar(e.target.files?.[0] || null)
                              }
                            />
                            <button
                              type="button"
                              className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                              onClick={() =>
                                document.getElementById("pfAvatar")?.click()
                              }
                            >
                              Alterar
                            </button>
                            {pfAvatar && (
                              <button
                                type="button"
                                className="px-2 py-1 rounded text-red-600 hover:bg-red-50"
                                onClick={() => setPfAvatar(null)}
                              >
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">
                            Nome
                          </label>
                          <input
                            value={pfName}
                            onChange={(e) => setPfName(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">
                            E-mail
                          </label>
                          <input
                            value={meProfile?.email || ""}
                            disabled
                            className="w-full border rounded px-3 py-2 bg-slate-50 text-slate-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">
                            Telefone
                          </label>
                          <input
                            value={pfPhone}
                            onChange={(e) => setPfPhone(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">
                            Endereço
                          </label>
                          <input
                            value={pfAddress}
                            onChange={(e) => setPfAddress(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">
                            Status
                          </label>
                          <input
                            value={pfStatus}
                            onChange={(e) => setPfStatus(e.target.value)}
                            placeholder="Ex.: Disponível"
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={saveProfile}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50"
                            onClick={() => {
                              setPfAvatar(null);
                              hydrateProfileEditor(undefined, { force: true });
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <div className="font-medium text-sm">
                          Alterar senha
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="password"
                            value={pwCurrent}
                            onChange={(e) => setPwCurrent(e.target.value)}
                            placeholder="Senha atual"
                            className="w-full border rounded px-3 py-2"
                          />
                          <input
                            type="password"
                            value={pwNew}
                            onChange={(e) => setPwNew(e.target.value)}
                            placeholder="Nova senha"
                            className="w-full border rounded px-3 py-2"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-900"
                              onClick={changePassword}
                            >
                              Atualizar senha
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {rightTab === "arquivos" && (
                <div className="space-y-2">
                  {messages
                    .filter((m) => m.type !== "text" && !m.deletedAt)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between border rounded px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {m.type === "image" || m.type === "gif"
                              ? "Imagem"
                              : m.type === "audio"
                              ? "Áudio"
                              : "Anexo"}
                          </div>
                          <div className="text-slate-500 truncate max-w-[220px]">
                            {m.type === "text"
                              ? m.content
                              : fileNameFromUrl(m.content) || m.content}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-500">
                            {new Date(m.createdAt).toLocaleDateString("pt-BR")}{" "}
                            {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <a
                            className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                            href={absUrl(m.content)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                    ))}
                  {messages.filter(
                    (m) => m.type !== "text" && !m.deletedAt
                  ).length === 0 && (
                    <div className="text-sm text-slate-500">
                      Nenhum arquivo nesta conversa.
                    </div>
                  )}
                </div>
              )}

              {rightTab === "favoritos" && (
                <div className="space-y-2">
                  {rightFavItems.map((m) => (
                    <div
                      key={m.id}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">
                          {m.author?.name || "Você"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString("pt-BR")}{" "}
                          {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="mt-1">
                        {m.type === "text"
                          ? m.content
                          : m.type === "image" || m.type === "gif"
                          ? "Imagem"
                          : m.type === "audio"
                          ? "Áudio"
                          : "Anexo"}
                      </div>
                      <div className="mt-1">
                        <button
                          className="text-[12px] text-red-600 hover:underline"
                          onClick={() => toggleFav(m)}
                        >
                          Remover favorito
                        </button>
                      </div>
                    </div>
                  ))}
                  {rightFavItems.length === 0 && (
                    <div className="text-sm text-slate-500">
                      Nenhuma mensagem favoritada nesta conversa.
                    </div>
                  )}
                </div>
              )}

              {rightMsg && (
                <div className="text-green-600 text-sm">{rightMsg}</div>
              )}
              {rightErr && (
                <div className="text-red-600 text-sm">{rightErr}</div>
              )}
            </>
          )}
        </div>
        </aside>
      )}
    </div>
  );
}

function MessageText({
  message,
  mine,
  editingId,
  editText,
  setEditText,
  onStartEdit,
  onSave,
  onCancel,
}) {
  const isEditing = editingId === message.id;
  if (isEditing) {
    return (
      <div>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm text-slate-800"
          rows={2}
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
            onClick={() => onSave(message, editText)}
          >
            Salvar
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded border border-slate-300 text-xs hover:bg-slate-50"
            onClick={() => onCancel()}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="whitespace-pre-wrap break-words">{message.content}</div>
      {message.editedAt && (
        <div className="text-[10px] opacity-70">(editado)</div>
      )}
    </div>
  );
}

function StatusTicks({ read, title }) {
  // WhatsApp-like double check icon. Branco quando visualizado, cinza quando entregue
  const color = read ? "#ffffff" : "#94a3b8";
  const outline = read ? "rgba(0,0,0,0.35)" : "none";
  const strokeMain = 2.2;
  const strokeOutline = read ? 3.2 : 0;
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex items-center ml-1"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7 13l-2 2 3 3 2-2-3-3z" fill={color} opacity="0.0" />
        {read && (
          <>
            {/* Outline (sombra) para contraste em fundos claros */}
            <path
              d="M1.5 13.5l4 4 7-7"
              stroke={outline}
              strokeWidth={strokeOutline}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 13.5l4 4 9-9"
              stroke={outline}
              strokeWidth={strokeOutline}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {/* TraÃ§o principal */}
        <path
          d="M1.5 13.5l4 4 7-7"
          stroke={color}
          strokeWidth={strokeMain}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 13.5l4 4 9-9"
          stroke={color}
          strokeWidth={strokeMain}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Avatar({ url, name, size = 28, status, showStatus = false }) {
  const [broken, setBroken] = useState(false);
  const containerStyle = {
    position: "relative",
    width: size,
    height: size,
    display: "inline-block",
  };
  const imgStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    display: "block",
  };
  const initials = (name || "U").trim().slice(0, 2).toUpperCase();
  const dotColor = (() => {
    const s = String(status || "").toLowerCase();
    if (s === "online") return "#16a34a"; // green-600
    if (s === "busy" || s === "ocupado") return "#dc2626"; // red-600
    if (s === "away" || s === "ausente") return "#f59e0b"; // amber-500
    return "#94a3b8"; // slate-400 (offline/unknown)
  })();
  const dotSize = Math.max(8, Math.floor(size * 0.32));
  const dotStyle = {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: dotSize,
    height: dotSize,
    borderRadius: "50%",
    background: dotColor,
    border: "2px solid rgba(255,255,255,0.95)",
    boxShadow: "0 0 0 1px rgba(15,23,42,0.08)",
  };
  return (
    <span style={containerStyle}>
      {url && !broken ? (
        <img
          src={absUrl(url)}
          alt={name || "avatar"}
          style={imgStyle}
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          style={{
            ...imgStyle,
            background: "#cbd5e1",
            color: "#334155",
            display: "grid",
            placeItems: "center",
            fontSize: Math.max(10, Math.floor(size * 0.42)),
            fontWeight: "bold",
          }}
        >
          {initials}
        </div>
      )}
      {showStatus && <span style={dotStyle} />}
    </span>
  );
}

