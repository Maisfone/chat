const fs = require('fs');
const path = 'client/src/pages/Chat.jsx';
let text = fs.readFileSync(path, 'utf8');
const requireReplace = (pattern, replacement) => {
  const next = text.replace(pattern, replacement);
  if (next === text) {
    throw new Error('Pattern not replaced');
  }
  text = next;
};
requireReplace('import { getUser } from "../state/auth.js";\r\n', 'import { getUser as getAuthUser, getToken, setAuth } from "../state/auth.js";\r\n');
requireReplace('const user = getUser();', 'const user = getAuthUser();');
requireReplace(/  const \[soundOn, setSoundOn\] = useState\(\(\) => \{[\s\S]*?\}\);\r?\n  function toggleSound\(\) \{[\s\S]*?\}\r?\n/, '  const soundOn = true; // sempre ligado\r\n');
requireReplace(/\s*<button[\s\S]*?Som: ON" || "Som: OFF"\}[\s\S]*?<\/button>\r?\n/, '\r\n');
requireReplace(/\s*\{\/\* Notificações \*\/\}[\s\S]*?<\/button>\r?\n/, '\r\n');
requireReplace(/\s*\{\/\* Som \*\/\}[\s\S]*?<\/button>\r?\n/, '\r\n');
requireReplace(/  async function saveProfile\(\) \{[\s\S]*?  \}\r?\n\r?\n  async function changePassword\(\) \{/, '  async function saveProfile() {\r\n    try {\r\n      setRightErr("");\r\n      setRightMsg("");\r\n      const form = new FormData();\r\n      form.append("name", pfName || "");\r\n      if (pfPhone !== undefined && pfPhone !== null)\r\n        form.append("phone", pfPhone);\r\n      if (pfAddress !== undefined && pfAddress !== null)\r\n        form.append("address", pfAddress);\r\n      if (pfAvatar) form.append("avatar", pfAvatar);\r\n      const result = await api.uploadPatch("/users/me", form);\r\n      try {\r\n        localStorage.setItem("profile_status", pfStatus || "");\r\n      } catch {}\r\n      const updatedUser = result?.user;\r\n      if (updatedUser) {\r\n        setMeProfile(updatedUser);\r\n        setPfName(updatedUser.name || "");\r\n        setPfPhone(updatedUser.phone || "");\r\n        setPfAddress(updatedUser.address || "");\r\n        try {\r\n          const token = getToken();\r\n          const storedUser = getAuthUser();\r\n          if (token && storedUser) {\r\n            setAuth(token, { ...storedUser, ...updatedUser });\r\n          }\r\n        } catch {}\r\n      } else {\r\n        await hydrateMe(true);\r\n      }\r\n      setRightMsg("Perfil atualizado");\r\n      setPfAvatar(null);\r\n    } catch (e) {\r\n      setRightErr(e?.message || "Falha ao salvar perfil");\r\n    }\r\n  }\r\n\r\n  async function changePassword() {\r\n');
fs.writeFileSync(path, text, 'utf8');
