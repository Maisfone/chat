import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, absUrl } from "../services/api.js";
import { ioClient } from "../services/socket.js";
import { getUser } from "../state/auth.js";

export default function Chat() {
  // Lists and active conversation
  const [groups, setGroups] = useState([]);
  const [dms, setDms] = useState([]);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(null);

  // Messages and composer
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  // Audio recording
  const [recording, setRecording] = useState(false);
  const [recError, setRecError] = useState("");
  const [recTime, setRecTime] = useState(0);

  // UI state/refs
  const [leftOpen, setLeftOpen] = useState(false);
  // Pinned/Muted groups (local only)
  const [pinned, setPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_pins')||'{}') } catch { return {} }
  });
  const [muted, setMuted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_mutes')||'{}') } catch { return {} }
  });
  function togglePin(id){ setPinned(prev=>{ const n={...(prev||{})}; n[id]=!n[id]; try{localStorage.setItem('chat_pins',JSON.stringify(n))}catch{} return n }) }
  function toggleMute(id){ setMuted(prev=>{ const n={...(prev||{})}; n[id]=!n[id]; try{localStorage.setItem('chat_mutes',JSON.stringify(n))}catch{} return n }) }
  const [menuFor, setMenuFor] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [convQuery, setConvQuery] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const emojis = [
    "😀",
    "😁",
    "😂",
    "🤣",
    "😊",
    "😍",
    "😘",
    "😎",
    "🤗",
    "😉",
    "🙃",
    "😅",
    "😴",
    "🤔",
    "🙄",
    "😐",
    "😢",
    "😭",
    "😡",
    "👍",
    "👎",
    "👏",
    "🙏",
    "💪",
    "🔥",
    "✨",
    "🎉",
    "❤️",
    "💙",
    "💚",
    "💛",
    "💜",
    "🤝",
    "👌",
    "✌️",
    "👀",
    "☕",
    "🍕",
    "🎧",
    "📞",
  ];
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const mediaRecRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recTimerRef = useRef(null);
  const user = getUser();

  // Notifications + sound + unread count in title
  const notifAskedKey = "chat_notif_asked";
  const [notifOk, setNotifOk] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission === "granted"
      : false
  );
  const initialTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "Chat"
  );
  const audioCtxRef = useRef(null);
  const customBufferRef = useRef({ url: '', buffer: null });
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("chat_sound") !== "0" } catch { return true }
  });
  function toggleSound() {
    try {
      const next = !soundOn; setSoundOn(next);
      localStorage.setItem("chat_sound", next ? "1" : "0");
    } catch {}
  }

  useEffect(() => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const asked = localStorage.getItem(notifAskedKey);
      if (Notification.permission === "default" && !asked) {
        Notification.requestPermission().then((p) => {
          setNotifOk(p === "granted");
          localStorage.setItem(notifAskedKey, "1");
        });
      } else {
        setNotifOk(Notification.permission === "granted");
      }
    } catch {}
  }, []);

  function previewFromMessage(msg) {
    if (!msg) return "";
    if (msg.type === "text") return msg.content || "";
    if (msg.type === "image" || msg.type === "gif") return "Imagem";
    if (msg.type === "audio") return "Áudio";
    return "Anexo";
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
          setActive({ id: msg.groupId, name: msg.group?.name || "Direto" });
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
        const url = localStorage.getItem('notif_sound_url') || '';
        if (url) {
          if (customBufferRef.current.url !== url || !customBufferRef.current.buffer) {
            const resp = await fetch(url);
            const arr = await resp.arrayBuffer();
            const buf = await ctx.decodeAudioData(arr.slice(0));
            customBufferRef.current = { url, buffer: buf };
          }
          const src = ctx.createBufferSource();
          src.buffer = customBufferRef.current.buffer;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + Math.min(0.8, src.buffer.duration));
          src.connect(g).connect(ctx.destination);
          src.start();
          return;
        }
      } catch {}
      // Fallback bip simples
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.31);
    } catch {}
  }

  // Desbloqueia o AudioContext após a primeira interação do usuário
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
  const [meProfile, setMeProfile] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    avatarUrl: "",
    isAdmin: false,
  });
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
  }, [active?.id]);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const desktopSearchToggleRef = useRef(null);
  const mobileSearchBarRef = useRef(null);
  const mobileSearchToggleRef = useRef(null);

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

  // Realtime: DM criada (join automático + atualizar lista de DMs)
  useEffect(() => {
    const s = ioClient();
    const meId = user?.id;
    if (!meId) return;
    const onDmCreated = (payload) => {
      try {
        const { groupId, userA, userB } = payload || {};
        if (!groupId || !userA?.id || !userB?.id) return;
        if (userA.id !== meId && userB.id !== meId) return; // não envolve este usuário
        const other = userA.id === meId ? userB : userA;
        // adiciona DM se ainda não existir
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

  // Realtime: atualizar lista de pessoas quando usuários forem criados/atualizados/excluídos
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
  async function startConversation(otherId, closeDrawer = false) {
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
        setActive({ id: dm.groupId, name: dm.other?.name || "Direto" });
        if (closeDrawer) setLeftOpen(false);
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
        setActive({ id: dm.groupId, name: dm.other?.name || "Direto" });
        if (closeDrawer) setLeftOpen(false);
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
        if (msg.groupId === active.id) {
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
          try { const mine = (msg.author?.id || msg.authorId) === user?.id; if (!mine && !muted?.[active.id]) playPing(); } catch {}
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
        }
        // Se a conversa não está ativa e a aba estiver oculta, notifica
        try {
          const mine = (msg.author?.id || msg.authorId) === user?.id;
          if (document.hidden && !mine && msg.groupId !== active.id) {
            try {
              playPing();
            } catch {}
            showNotificationFor(msg);
          }
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
      s.on("message:deleted", onDeleted);
      unsub = () => {
        setMenuFor(null);
        s.off("message:new", onNew);
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
      const hasText = Boolean(text.trim());
      const hasFile = Boolean(file);
      if (hasText) {
        const content = text.trim();
        const isUrl = /^(https?:\/\/\S+)/i.test(content);
        const lower = content.toLowerCase();
        const isGif = isUrl && /(\.gif($|\?))/i.test(lower);
        const isImg =
          isUrl && /(\.png|\.jpg|\.jpeg|\.webp|\.bmp|\.svg)($|\?)/i.test(lower);
        const type = isGif ? "gif" : isImg ? "image" : "text";
        const created = await api.post(`/messages/${active.id}`, {
          type,
          content,
          replyToId: replyTo?.id || null,
        });
        setMessages((prev) => {
          if ((prev || []).some((m) => m.id === created.id)) return prev;
          return [...prev, created];
        });
        setText("");
        setReplyTo(null);
      }
      if (hasFile) {
        const form = new FormData();
        form.append("file", file);
        const kind = file.type?.startsWith("audio") ? "audio" : "image";
        const q = replyTo?.id ? `&replyToId=${replyTo.id}` : "";
        const created2 = await api.upload(
          `/messages/${active.id}/upload?type=${kind}${q}`,
          form
        );
        setMessages((prev) => {
          if ((prev || []).some((m) => m.id === created2.id)) return prev;
          return [...prev, created2];
        });
        setFile(null);
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
      setShowEmoji(false);
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
    setShowEmoji(false);
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
          setRecError(e.message || "Falha ao salvar áudio");
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

  // Right sidebar logic
  async function hydrateMe(force = false) {
    try {
      setRightLoading(true);
      const me = await api.get("/users/me");
      setMeProfile(me || {});
      if (force || !pfName) setPfName(me?.name || "");
      if (force || !pfPhone) setPfPhone(me?.phone || "");
      if (force || !pfAddress) setPfAddress(me?.address || "");
      setRightErr("");
      setRightMsg("");
      try {
        const st = localStorage.getItem("profile_status");
        if (st !== null) setPfStatus(st);
      } catch {}
    } catch (e) {
      setRightErr("Falha ao carregar perfil");
    } finally {
      setRightLoading(false);
    }
  }
  function openRightProfile() {
    setRightOpen(true);
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
  const filteredGroups = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    let list = q
      ? groups.filter((g) => (g.name || "").toLowerCase().includes(q))
      : groups;
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
      return (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });
    });
  }, [groups, convQuery]);

  const filteredPeople = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    const list = q
      ? people.filter((p) => (p.name || "").toLowerCase().includes(q))
      : people;
    return [...list].sort((a, b) => {
      const da = dms.find((d) => d.other?.id === a.id);
      const db = dms.find((d) => d.other?.id === b.id);
      const la = da?._lastAt || 0,
        lb = db?._lastAt || 0;
      if (la !== lb) return lb - la;
      const ua = da?._unread || 0,
        ub = db?._unread || 0;
      if (ua !== ub) return ub - ua;
      // preserve original order as final tie-breaker (no alphabetical)
      const ia = people.findIndex((p) => p.id === a.id);
      const ib = people.findIndex((p) => p.id === b.id);
      return ia - ib;
    });
  }, [people, dms, convQuery]);

  // Hydrate Groups with last activity/preview on initial load/refresh (similar to DMs)
  useEffect(() => {
    (async () => {
      try {
        const pending = (groups || []).filter(
          (g) => g && g.id && (g._lastAt === undefined || g._lastAt === null || g._lastPreview === undefined)
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
                ? { ...x, _lastAt: updates[x.id].last, _lastPreview: updates[x.id].prev }
                : x
            )
          );
        }
      } catch {}
    })();
  }, [groups]);

  return (
    <div className="relative flex h-full">
      {leftOpen && (
        <>
          <div
            className="absolute inset-0 bg-black/20 z-10"
            onClick={() => setLeftOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 border-r border-slate-200 bg-white flex flex-col overflow-auto z-20">
            <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
              <input
                value={convQuery}
                onChange={(e) => setConvQuery(e.target.value)}
                placeholder="Buscar conversas..."
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <button
                className={`text-sm px-2 py-1 rounded border ${soundOn ? 'border-green-500 text-green-700' : 'border-slate-300 text-slate-600'} hover:bg-slate-50`}
                onClick={toggleSound}
                title={soundOn ? 'Som: ligado' : 'Som: desligado'}
              >
                {soundOn ? 'Som: ON' : 'Som: OFF'}
              </button>
              <button
                className="text-slate-500 hover:text-slate-700"
                onClick={() => setLeftOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="px-3 py-2 font-semibold">Grupos</div>
            {filteredGroups.map((g) => {
              const lastAt = g?._lastAt || 0;
              const lastLabel = lastAt
                ? new Date(lastAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : "";
              const preview = g?._lastPreview || "";
              const selected = active?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setActive(g);
                    setLeftOpen(false);
                  }}
                  className={`px-2 py-2 rounded flex items-center justify-between gap-2 w-full text-left ${
                    selected ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {g.avatarUrl ? (
                      <img src={absUrl(g.avatarUrl)} alt={g.name||'grupo'} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-700 grid place-items-center text-xs font-semibold">
                        {(g.name || "G").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="flex flex-col items-start min-w-0">
                      <span className={`truncate font-medium ${g._unread > 0 ? "font-semibold" : ""}`}>{g.name}</span>
                      {preview && (
                        <span className="truncate text-xs text-slate-500 max-w-[180px]">{preview}</span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {lastLabel && (
                      <span className="text-[11px] text-slate-500">{lastLabel}</span>
                    )}
                    {g._unread > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">
                        {g._unread}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            <div className="px-3 py-2 font-semibold border-t border-slate-200 mt-2">
              Pessoas
            </div>
            <div className="px-3 py-2 flex flex-col gap-1">
              {(() => {
                const els = [];
                let last = "";
                for (const p of filteredPeople) {
                  const letter = ((p.name || "").trim()[0] || "?").toUpperCase();
                  if (letter !== last) {
                    last = letter;
                    els.push(
                      <div key={`hdr-${letter}`} className="px-2 pt-2 text-xs font-semibold text-slate-500 select-none">
                        {letter}
                      </div>
                    );
                  }
                  const dmInfo = dms.find((d) => d.other?.id === p.id);
                  const unread = dmInfo?._unread || 0;
                  const lastAt = dmInfo?._lastAt || 0;
                  const lastLabel = lastAt
                    ? new Date(lastAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "";
                  const preview = dmInfo?._lastPreview || "";
                  const isSelected = active?.id && dmInfo?.groupId && active.id === dmInfo.groupId;
                  els.push(
                    <button
                      key={p.id}
                      onClick={() => startConversation(p.id, true)}
                      className={`rounded px-2 py-2 flex items-center justify-between gap-2 w-full text-left ${
                        isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Avatar url={p.avatarUrl} name={p.name} />
                        <span className="flex flex-col items-start min-w-0">
                          <span className="truncate font-medium">{p.name}</span>
                          {preview && (
                            <span className="truncate text-xs text-slate-500 max-w-[180px]">{preview}</span>
                          )}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {lastLabel && (
                          <span className="text-[11px] text-slate-500">{lastLabel}</span>
                        )}
                        {unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">
                            {unread}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                }
                return els.length ? els : (
                  <div className="px-3 py-4 text-sm text-slate-500">Nenhuma pessoa encontrada</div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-80 border-r border-slate-200 flex-col overflow-auto">
        <div className="px-3 py-2 border-b border-slate-200">
          <input
            value={convQuery}
            onChange={(e) => setConvQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div className="px-3 py-2 font-semibold">Grupos</div>
        {filteredGroups.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g)}
            className={`px-3 py-2 hover:bg-slate-50 ${
              active?.id === g.id ? "bg-blue-50 text-blue-700" : ""
            } flex items-center justify-between`}
          >
            <span className="truncate text-left">{g.name}</span>
            {g._unread > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">
                {g._unread}
              </span>
            )}
          </button>
        ))}
        <div className="px-3 py-2 font-semibold border-t border-slate-200 mt-2">
          Pessoas
        </div>
        <div className="px-3 py-2 flex flex-col gap-1">
          {filteredPeople.map((p) => {
            const dmInfo = dms.find((d) => d.other?.id === p.id);
            const unread = dmInfo?._unread || 0;
            const lastAt = dmInfo?._lastAt || 0;
            const lastLabel = lastAt
              ? new Date(lastAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const preview = dmInfo?._lastPreview || "";
            return (
              <button
                key={p.id}
                onClick={() => startConversation(p.id)}
                className="hover:bg-slate-50 rounded px-2 py-2 flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Avatar url={p.avatarUrl} name={p.name} />
                  <span className="flex flex-col items-start min-w-0">
                    <span className="truncate font-medium">{p.name}</span>
                    {preview && (
                      <span className="truncate text-xs text-slate-500 max-w-[180px]">
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
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur font-medium flex items-center gap-2">
          <button
            type="button"
            className="md:hidden px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
            onClick={() => setLeftOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <button
            type="button"
            className="truncate text-left hover:underline"
            onClick={() => openRightProfile()}
            title="Abrir perfil"
          >
            {active?.name || "Selecione um grupo"}
          </button>
          <div className="ml-auto flex items-center gap-1">
            {/* Mobile search toggle */}
            <button
              ref={mobileSearchToggleRef}
              type="button"
              className="md:hidden px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              title="Buscar"
              aria-label="Buscar"
              onClick={toggleMobileSearch}
            >
              🔍
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
              🔍
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
                    className="px-1.5 py-1 rounded hover:bg-slate-100"
                    title="Anterior"
                    onClick={() => jumpToMatch(false)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="px-1.5 py-1 rounded hover:bg-slate-100"
                    title="Próximo"
                    onClick={() => jumpToMatch(true)}
                  >
                    ▼
                  </button>
                  {searchQuery && (
                    <button
                      type="button"
                      className="px-1.5 py-1 rounded hover:bg-slate-100"
                      title="Limpar"
                      onClick={() => setSearchQuery("")}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

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
              className="px-1.5 py-1 rounded hover:bg-slate-100"
              title="Anterior"
              onClick={() => jumpToMatch(false)}
            >
              ▲
            </button>
            <button
              type="button"
              className="px-1.5 py-1 rounded hover:bg-slate-100"
              title="Próximo"
              onClick={() => jumpToMatch(true)}
            >
              ▼
            </button>
            {searchQuery && (
              <button
                type="button"
                className="px-1.5 py-1 rounded hover:bg-slate-100"
                title="Limpar"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Right sidebar: Meu Perfil */}
        {rightOpen && (
          <>
            <div
              className="absolute inset-0 bg-black/20 z-30"
              onClick={() => setRightOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 w-[360px] max-w-[90%] bg-white border-l border-slate-200 z-40 shadow-lg flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold">Detalhes</div>
                <button
                  className="text-slate-500 hover:text-slate-700"
                  onClick={() => setRightOpen(false)}
                >
                  ✕
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
                                  document.getElementById("pfAvatar").click()
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
                                hydrateMe(true);
                              }}
                            >
                              Recarregar
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-3">
                          <div className="font-semibold mb-2">
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
                                  {m.content}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-slate-500">
                                  {new Date(m.createdAt).toLocaleDateString(
                                    "pt-BR"
                                  )}{" "}
                                  {new Date(m.createdAt).toLocaleTimeString(
                                    "pt-BR",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
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
                                {new Date(m.createdAt).toLocaleDateString(
                                  "pt-BR"
                                )}{" "}
                                {new Date(m.createdAt).toLocaleTimeString(
                                  "pt-BR",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
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
          </>
        )}

        <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3">
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
                  <div className="text-center text-xs text-slate-500 my-2">
                    {dateLabel}
                  </div>
                )}
                <div className={`${lineClass} group`}>
                  {!mine && (
                    <div className="mr-2">
                      <Avatar url={m.author?.avatarUrl} name={m.author?.name} />
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
                      <div>{m.content}</div>
                    ) : m.type === "image" || m.type === "gif" ? (
                      <img
                        src={absUrl(m.content)}
                        alt="imagem"
                        className="max-w-full rounded"
                      />
                    ) : m.type === "audio" ? (
                      <audio
                        src={absUrl(m.content)}
                        controls
                        className="w-60"
                      />
                    ) : (
                      <a
                        className="underline"
                        href={absUrl(m.content)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir anexo
                      </a>
                    )}
                    <div className="mt-1 text-[10px] opacity-80 flex items-center gap-2">
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
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
                        ★
                      </button>
                    </div>
                  </div>
                  <div className="ml-1 relative">
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-700"
                      onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      aria-label="Ações"
                    >
                      ⋯
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

        <form
          onSubmit={sendMessage}
          className="flex gap-2 p-2 border-t border-slate-200 items-center relative"
        >
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            title="Emojis"
            className="px-2 py-1 rounded hover:bg-slate-100"
            aria-label="Emojis"
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar"
            className="inline-flex shrink-0 items-center justify-center p-2 rounded hover:bg-slate-100"
            aria-label="Anexar"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {file && (
            <div className="max-w-[45%] truncate text-xs text-slate-700 bg-slate-100 rounded px-2 py-1 flex items-center gap-2">
              <span className="truncate" title={file.name}>
                {file.name}
              </span>
              <button
                type="button"
                className="text-slate-500 hover:text-red-600"
                onClick={() => setFile(null)}
              >
                ✕
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem (suporta URL .gif/.jpg etc.)"
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            type="button"
            onClick={() => {
              if ((text || "").trim() || file) {
                sendMessage();
              } else {
                recording ? stopRecording() : startRecording();
              }
            }}
            className={`${
              (text || "").trim() || file
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : recording
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            } inline-flex items-center justify-center rounded-full w-10 h-10`}
            title={
              (text || "").trim() || file
                ? "Enviar"
                : recording
                ? "Parar gravação"
                : "Gravar áudio"
            }
          >
            {(text || "").trim() || file ? (
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
          {recording && (
            <span className="text-xs text-red-600 min-w-[60px]">
              ⏺ {recTime}s
            </span>
          )}
          {err && <div className="text-red-600 text-sm ml-2">{err}</div>}
          {recError && (
            <div className="text-red-600 text-sm ml-2">{recError}</div>
          )}

          {showEmoji && (
            <div className="absolute bottom-12 left-2 bg-white border border-slate-200 rounded-md p-2 shadow max-w-[280px] z-10">
              <div className="grid grid-cols-8 gap-1">
                {emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="text-xl leading-6 hover:bg-slate-100 rounded px-1"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Avatar({ url, name }) {
  const size = 28;
  const style = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
  };
  if (url)
    return <img src={absUrl(url)} alt={name || "avatar"} style={style} />;
  const initials = (name || "U").trim().slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        ...style,
        background: "#cbd5e1",
        color: "#334155",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {initials}
    </div>
  );
}

// Helpers for right sidebar (defined after component and hoisted above via closures)
