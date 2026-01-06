from pathlib import Path
text = Path('client/src/pages/Chat.jsx').read_text(encoding='utf-8')
start = text.find('// Load lists (groups, DMs, people)')
if start == -1:
    raise SystemExit('start not found')
end = text.find('// For', start)
if end == -1:
    raise SystemExit('end not found')
new_block = """// Load lists (groups, DMs, people)
  const refreshTimeoutRef = useRef(null);
  const refreshConversations = useCallback(
    async ({ restoreActive = false } = {}) => {
      const rawGroups = toArray(await api.get("/groups"));
      const normalizedGroups = normalizeConversationList(rawGroups);
      const dmListRaw = toArray(await api.get("/dm"));
      const normalizedDms = normalizeConversationList(dmListRaw);
      setGroups(normalizedGroups);
      setDms(normalizedDms);
      if (restoreActive) {
        const saved = localStorage.getItem("chat_active");
        if (saved) {
          const foundG = normalizedGroups.find((x) => x.id === saved);
          if (foundG) {
            setActive(foundG);
            hideLeftIfMobile();
            return { normalizedGroups, normalizedDms };
          }
          const foundDM = normalizedDms.find((x) => x.groupId === saved);
          if (foundDM) {
            setActive({
              id: foundDM.groupId,
              name: foundDM.other?.name || "Direto",
              avatarUrl: foundDM.other?.avatarUrl || undefined,
            });
            hideLeftIfMobile();
            return { normalizedGroups, normalizedDms };
          }
        }
        if (normalizedGroups[0]) {
          setActive(normalizedGroups[0]);
          hideLeftIfMobile();
        } else if (normalizedDms[0]) {
          setActive({
            id: normalizedDms[0].groupId,
            name: normalizedDms[0].other?.name || "Direto",
            avatarUrl: normalizedDms[0].other?.avatarUrl || undefined,
          });
          hideLeftIfMobile();
        }
      }
      return { normalizedGroups, normalizedDms };
    },
    [normalizeConversationList, hideLeftIfMobile]
  );

  const refreshConversationsSoon = useCallback(() => {
    if (refreshTimeoutRef.current) return;
    refreshTimeoutRef.current = setTimeout(async () => {
      refreshTimeoutRef.current = null;
      try {
        await refreshConversations();
      } catch (e) {
        setErr((prev) => prev || e?.message || "Falha ao atualizar listas");
      }
    }, 150);
  }, [refreshConversations]);

  useEffect(() => {
    (async () => {
      try {
        await refreshConversations({ restoreActive: true });
        const ppl = toArray(await api.get("/users/all"));
        setPeople(ppl);
      } catch (e) {
        setErr("Falha ao carregar listas");
      }
    })();
  }, [refreshConversations, hideLeftIfMobile]);
"""
text = text[:start] + new_block + text[end:]
Path('client/src/pages/Chat.jsx').write_text(text, encoding='utf-8')
