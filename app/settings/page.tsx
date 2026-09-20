'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Key, Mail, Bot, Save, RefreshCw, CheckCircle, AlertTriangle, 
  MessageSquare, ToggleLeft, ToggleRight, Info, ShieldCheck, User, Lock, 
  Palette, Grid, Upload, ChevronRight, BookOpen, Plus, Trash2, Sparkles, 
  Layers, X, Check, ChevronUp, ChevronDown, Eye, EyeOff, Cpu, Zap, ShieldAlert, Edit3
} from 'lucide-react';

type SectionType = 'overview' | 'profile' | 'security' | 'appearance' | 'whatsapp' | 'ai' | 'smtp' | 'system' | 'branding';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionType>('overview');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Branding States
  const [brandingCompanyName, setBrandingCompanyName] = useState('Fuxion Flow');
  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar si es una imagen
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (.png, .jpg, .svg)');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setBrandingLogoUrl(dataUrl);
        setSuccessMsg('¡Logo cargado desde tu equipo! Recuerda presionar Guardar Marca.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  // SMTP Test State
  const [testingEmail, setTestingEmail] = useState(false);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Guardar configuraciones de forma silenciosa antes de probar
      await handleSubmit(undefined, { silent: true });

      const res = await fetch('/api/settings/test-email', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        setTimeout(() => setSuccessMsg(null), 10000);
      } else {
        setErrorMsg(data.error || 'Error al enviar el correo de prueba');
        setTimeout(() => setErrorMsg(null), 10000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor de prueba');
      setTimeout(() => setErrorMsg(null), 10000);
    } finally {
      setTestingEmail(false);
    }
  };

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/settings/branding');
      const data = await res.json();
      if (data.companyName) setBrandingCompanyName(data.companyName);
      if (data.logoUrl) setBrandingLogoUrl(data.logoUrl);
    } catch (e) {
      console.error('Error fetching branding:', e);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: brandingCompanyName,
          logoUrl: brandingLogoUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('¡Configuración de Marca y Logo actualizada correctamente!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error('Error saving branding:', e);
    } finally {
      setSavingBranding(false);
    }
  };

  // Appearance Local Settings (to show change updates in real-time)
  const [selectedMode, setSelectedMode] = useState<'light' | 'dark'>('dark');
  const [selectedAccent, setSelectedAccent] = useState<'emerald' | 'neon-glass' | string>('emerald');

  // System settings state
  const [configs, setConfigs] = useState({
    whatsapp_api_url: '',
    whatsapp_api_key: '',
    whatsapp_instance: '',
    whatsapp_business_id: '',
    whatsapp_verify_token: '',
    gemini_api_key: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    admin_email: '',
    ai_enabled: 'true',
    google_sheets_url: '',
    google_sheet_id: '',
    google_service_account: '',
    display_name: 'Andy Cruz',
    user_avatar: '',
    appearance_mode: 'dark',
    appearance_accent: 'emerald'
  });
  const [secretMeta, setSecretMeta] = useState<{ masked: Record<string, string>; configured: Record<string, boolean> }>({ masked: {}, configured: {} });

  // AI Behavior Rules State
  const [aiRules, setAiRules] = useState<Array<{ id: string; title: string; instruction: string; category: string; is_active: boolean }>>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleInstruction, setNewRuleInstruction] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('Tono y Estilo');
  const [selectedRuleCategoryFilter, setSelectedRuleCategoryFilter] = useState('Todas');

  // Dynamic AI Keys State (Max 4 keys)
  interface AiKeyItem {
    id: string;
    provider: 'google' | 'groq' | 'openrouter' | 'openai';
    name: string;
    apiKey: string;
    model: string;
    priority: number;
    isActive: boolean;
  }

  const [aiKeysList, setAiKeysList] = useState<AiKeyItem[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<'google' | 'groq' | 'openrouter' | 'openai'>('google');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyApiKey, setNewKeyApiKey] = useState('');
  const [newKeyModel, setNewKeyModel] = useState('gemini-3.6-flash');
  const [showKeyPassword, setShowKeyPassword] = useState<{ [id: string]: boolean }>({});
  const [savingAiKeys, setSavingAiKeys] = useState(false);

  const providerModelsMap: { [key: string]: { label: string; value: string }[] } = {
    google: [
      { label: 'Gemini 3.6 Flash (Oficial / Ultra Rápido)', value: 'gemini-3.6-flash' }
    ],
    groq: [
      { label: 'Llama 3.3 70B Versatile (Recomendado / Gratis)', value: 'llama-3.3-70b-versatile' },
      { label: 'Llama 3.1 70B Versatile', value: 'llama-3.1-70b-versatile' },
      { label: 'Mixtral 8x7B (Ultra Rápido)', value: 'mixtral-8x7b-32768' }
    ],
    openrouter: [
      { label: 'Auto-Router Multimodelo (Gratis Automático)', value: 'openrouter/auto' },
      { label: 'Meta Llama 3.1 8B Free', value: 'meta-llama/llama-3.1-8b-instruct:free' },
      { label: 'Google Gemma 2 9B Free', value: 'google/gemma-2-9b-it:free' }
    ],
    openai: [
      { label: 'GPT-4o Mini (Económico & Rápido)', value: 'gpt-4o-mini' },
      { label: 'GPT-4o (Máxima Capacidad)', value: 'gpt-4o' }
    ]
  };

  const detectProviderFromKey = (key: string): { provider: 'google' | 'groq' | 'openrouter' | 'openai'; name: string; model: string } => {
    const clean = key.trim();
    if (clean.startsWith('gsk_')) {
      return {
        provider: 'groq',
        name: 'Groq Llama-3 (Alta Velocidad)',
        model: 'llama-3.3-70b-versatile'
      };
    }
    if (clean.startsWith('sk-or-')) {
      return {
        provider: 'openrouter',
        name: 'OpenRouter (Multimodelo)',
        model: 'openrouter/auto'
      };
    }
    if (clean.startsWith('sk-proj-') || (clean.startsWith('sk-') && !clean.startsWith('sk-or-'))) {
      return {
        provider: 'openai',
        name: 'OpenAI ChatGPT (GPT-4o Mini)',
        model: 'gpt-4o-mini'
      };
    }
    if (clean.startsWith('AIzaSy') || clean.startsWith('AQ.')) {
      return {
        provider: 'google',
        name: 'Google Gemini (Principal)',
        model: 'gemini-3.6-flash'
      };
    }
    return {
      provider: newKeyProvider,
      name: newKeyName.trim() || 'Clave de IA',
      model: newKeyModel
    };
  };

  const handleApiKeyInputChange = (val: string) => {
    setNewKeyApiKey(val);
    const clean = val.trim();
    if (clean.length >= 8) {
      const detected = detectProviderFromKey(clean);
      setNewKeyProvider(detected.provider);
      setNewKeyModel(detected.model);
      if (!newKeyName || newKeyName.startsWith('Google') || newKeyName.startsWith('Groq') || newKeyName.startsWith('OpenRouter') || newKeyName.startsWith('OpenAI')) {
        setNewKeyName(detected.name);
      }
    }
  };

  const handleProviderChange = (prov: 'google' | 'groq' | 'openrouter' | 'openai') => {
    setNewKeyProvider(prov);
    const defaultModels = providerModelsMap[prov];
    if (defaultModels && defaultModels.length > 0) {
      setNewKeyModel(defaultModels[0].value);
    }
    const defaultNames: { [key: string]: string } = {
      google: 'Google Gemini (Principal)',
      groq: 'Groq Llama-3 (Alta Velocidad)',
      openrouter: 'OpenRouter Multimodelo',
      openai: 'OpenAI ChatGPT'
    };
    setNewKeyName(defaultNames[prov] || '');
  };

  const handleAddAiKey = () => {
    if (aiKeysList.length >= 4) {
      setErrorMsg('Alcanzaste el límite máximo de 4 claves de API.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    if (!newKeyApiKey.trim()) {
      setErrorMsg('Por favor ingresa la clave de API Key.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const detected = detectProviderFromKey(newKeyApiKey);
    const finalProvider = newKeyProvider || detected.provider;
    const finalModel = newKeyModel || detected.model;
    const finalName = newKeyName.trim() || detected.name;

    const newItem: AiKeyItem = {
      id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      provider: finalProvider,
      name: finalName,
      apiKey: newKeyApiKey.trim(),
      model: finalModel,
      priority: aiKeysList.length + 1,
      isActive: true
    };

    const updatedList = [...aiKeysList, newItem];
    setAiKeysList(updatedList);
    setNewKeyName('');
    setNewKeyApiKey('');
    setSuccessMsg(`¡Clave agregada a la Cascada #${updatedList.length}!`);
    setTimeout(() => setSuccessMsg(null), 3000);

    saveAiKeysToSystem(updatedList);
  };

  const handleRemoveAiKey = (id: string) => {
    const filtered = aiKeysList.filter(k => k.id !== id);
    const reindexed = filtered.map((k, index) => ({ ...k, priority: index + 1 }));
    setAiKeysList(reindexed);
    saveAiKeysToSystem(reindexed);
  };

  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [keyTestStatus, setKeyTestStatus] = useState<{ [id: string]: { success: boolean; message: string } }>({});

  const handleTestAiKey = async (item: AiKeyItem) => {
    setTestingKeyId(item.id);
    try {
      // Clave enmascarada (guardada en servidor): se prueba por id sin exponerla.
      // Clave recién escrita: se prueba en claro una sola vez.
      const isMasked = !item.apiKey || item.apiKey.includes('****');
      const res = await fetch(isMasked ? '/api/ai/test-stored' : '/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isMasked
          ? { id: item.id }
          : {
              provider: item.provider,
              apiKey: item.apiKey,
              model: item.model
            })
      });
      const data = await res.json();
      setKeyTestStatus(prev => ({
        ...prev,
        [item.id]: {
          success: data.success,
          message: data.success ? (data.message || 'Conexión exitosa y activa') : (data.error || 'Fallo de conexión')
        }
      }));
    } catch (err: any) {
      setKeyTestStatus(prev => ({
        ...prev,
        [item.id]: {
          success: false,
          message: err.message || 'Error al conectar con el servidor'
        }
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleToggleAiKey = (id: string) => {
    const updated = aiKeysList.map(k => k.id === id ? { ...k, isActive: !k.isActive } : k);
    setAiKeysList(updated);
    saveAiKeysToSystem(updated);
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === aiKeysList.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newList = [...aiKeysList];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    const reindexed = newList.map((k, i) => ({ ...k, priority: i + 1 }));
    setAiKeysList(reindexed);
    saveAiKeysToSystem(reindexed);
  };

  const saveAiKeysToSystem = async (keys: AiKeyItem[]) => {
    setSavingAiKeys(true);
    try {
      const primaryGemini = keys.find(k => k.provider === 'google')?.apiKey || '';
      const primaryGroq = keys.find(k => k.provider === 'groq')?.apiKey || '';

      await fetch('/api/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ai_api_keys: JSON.stringify(keys),
            gemini_api_key: primaryGemini,
            groq_api_key: primaryGroq
          }
        })
      });
    } catch (e) {
      console.error('Error saving AI keys:', e);
    } finally {
      setSavingAiKeys(false);
    }
  };

  const fetchAIRules = async () => {
    setRulesLoading(true);
    try {
      const res = await fetch('/api/settings/ai-rules');
      const data = await res.json();
      if (data.success && data.rules) {
        setAiRules(data.rules);
      }
    } catch (err) {
      console.error('Error fetching AI rules:', err);
    } finally {
      setRulesLoading(false);
    }
  };

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const handleOpenEditRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setNewRuleTitle(rule.title);
    setNewRuleInstruction(rule.instruction);
    setNewRuleCategory(rule.category || 'General');
    setShowAddRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim() || !newRuleInstruction.trim()) return;

    try {
      if (editingRuleId) {
        // Modo Edición
        const res = await fetch('/api/settings/ai-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRuleId,
            title: newRuleTitle.trim(),
            instruction: newRuleInstruction.trim(),
            category: newRuleCategory
          })
        });
        const data = await res.json();
        if (data.success) {
          setAiRules(prev => prev.map(r => r.id === editingRuleId ? {
            ...r,
            title: newRuleTitle.trim(),
            instruction: newRuleInstruction.trim(),
            category: newRuleCategory
          } : r));
          setNewRuleTitle('');
          setNewRuleInstruction('');
          setEditingRuleId(null);
          setShowAddRuleModal(false);
          setSuccessMsg('¡Regla actualizada con éxito!');
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      } else {
        // Modo Creación
        const res = await fetch('/api/settings/ai-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newRuleTitle.trim(),
            instruction: newRuleInstruction.trim(),
            category: newRuleCategory
          })
        });
        const data = await res.json();
        if (data.success && data.rule) {
          setAiRules(prev => [...prev, data.rule]);
          setNewRuleTitle('');
          setNewRuleInstruction('');
          setShowAddRuleModal(false);
          setSuccessMsg('¡Regla creada con éxito!');
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }
    } catch (err: any) {
      console.error('Error saving AI rule:', err);
      setErrorMsg('No se pudo guardar la regla.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleToggleRuleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setAiRules(prev => prev.map(r => r.id === id ? { ...r, is_active: nextStatus } : r));

    try {
      await fetch('/api/settings/ai-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: nextStatus })
      });
    } catch (err) {
      console.error('Error toggling rule:', err);
    }
  };

  const handleDeleteRuleItem = async (id: string) => {
    setAiRules(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/settings/ai-rules?id=${id}`, { method: 'DELETE' });
      setSuccessMsg('Regla eliminada.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  const fetchConfigs = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/settings/configs');
      const data = await res.json();
      
      let loggedInName = 'Usuario';
      let loggedInEmail = 'admin@sudominio.com';
      let loggedInAvatar = '';
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (meData.success && meData.user) {
          loggedInName = meData.user.name || 'Usuario';
          loggedInEmail = meData.user.email || 'admin@sudominio.com';
          loggedInAvatar = meData.user.avatarUrl || '';
        }
      } catch (meErr) {
        console.error('Error fetching auth me profile details:', meErr);
      }

      if (data.success && data.configs) {
        setSecretMeta({ masked: data.masked || {}, configured: data.configured || {} });
        const loadedConfigs = {
          whatsapp_api_url: data.configs.whatsapp_api_url || '',
          // Secretos: nunca se rellenan en claro. El input queda vacío y muestra máscara como placeholder.
          whatsapp_api_key: '',
          whatsapp_instance: data.configs.whatsapp_instance || '',
          whatsapp_business_id: data.configs.whatsapp_business_id || '',
          whatsapp_verify_token: data.configs.whatsapp_verify_token || '',
          gemini_api_key: '',
          smtp_host: data.configs.smtp_host || '',
          smtp_port: data.configs.smtp_port || '',
          smtp_user: data.configs.smtp_user || '',
          smtp_pass: '',
          smtp_from: data.configs.smtp_from || '',
          admin_email: data.configs.admin_email || loggedInEmail || '',
          ai_enabled: data.configs.ai_enabled || 'true',
          google_sheets_url: data.configs.google_sheets_url || '',
          google_sheet_id: data.configs.google_sheet_id || '',
          // Secreto: nunca se rellena, solo máscara como placeholder
          google_service_account: '',
          display_name: loggedInName,
          user_avatar: loggedInAvatar || data.configs.user_avatar || '',
          appearance_mode: data.configs.appearance_mode || 'dark',
          appearance_accent: data.configs.appearance_accent || 'emerald'
        };
        setConfigs(loadedConfigs);
        setSelectedMode(loadedConfigs.appearance_mode as any);
        setSelectedAccent(loadedConfigs.appearance_accent as any);

        const maskedAiKeys = data.masked?.ai_api_keys;
        if (maskedAiKeys) {
          try {
            const parsed = JSON.parse(maskedAiKeys);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Las claves llegan enmascaradas: se muestran metadatos sin exponer el secreto.
              setAiKeysList(parsed.sort((a: any, b: any) => a.priority - b.priority));
            } else {
              setAiKeysList([]);
            }
          } catch (e) {
            console.error('Error parsing ai_api_keys:', e);
          }
        } else if (data.configs.ai_api_keys) {
          try {
            const parsed = JSON.parse(data.configs.ai_api_keys);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAiKeysList(parsed.sort((a: any, b: any) => a.priority - b.priority));
            }
          } catch (e) {
            console.error('Error parsing ai_api_keys:', e);
          }
        } else {
          const defaults: AiKeyItem[] = [];
          setAiKeysList(defaults);
        }
      }
    } catch (err) {
      console.error('Error fetching configs:', err);
      setErrorMsg('No se pudieron cargar las configuraciones del sistema.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchAIRules();
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.avatarUrl) {
        setConfigs(prev => ({
          ...prev,
          user_avatar: data.avatarUrl
        }));
        setSuccessMsg('Foto de perfil actualizada con éxito.');
        window.setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        throw new Error(data.error || 'Error al subir la imagen');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleAppearanceUpdate = async (mode: 'light' | 'dark', accent: 'emerald' | 'neon-glass' | string) => {
    const validAccent = accent === 'neon-glass' ? 'neon-glass' : 'emerald';
    setSelectedMode(mode);
    setSelectedAccent(validAccent);
    setConfigs(prev => ({
      ...prev,
      appearance_mode: mode,
      appearance_accent: validAccent
    }));

    // Aplicar al instante en el elemento raíz del navegador
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('theme-emerald', 'theme-neon-glass', 'theme-violet', 'theme-cobalt', 'theme-amber', 'theme-rose');
      document.documentElement.classList.add(`theme-${validAccent}`);
      if (mode === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
      localStorage.setItem('crm_theme_accent', validAccent);
      localStorage.setItem('crm_theme_mode', mode);
    }

    // Persistir de inmediato en la base de datos sin obligar a presionar "Guardar"
    try {
      await fetch('/api/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            appearance_mode: mode,
            appearance_accent: validAccent
          }
        })
      });
    } catch (err) {
      console.error('Error auto-guardando apariencia:', err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, options?: { silent?: boolean }) => {
    if (e) e.preventDefault();
    setLoading(true);
    if (!options?.silent) {
      setSuccessMsg(null);
      setErrorMsg(null);
    }

    try {
      // No enviar secretos vacíos: el backend los preserva. Solo se actualizan si el usuario escribió uno nuevo.
      const payload: Record<string, string> = { ...configs };
      for (const k of ['whatsapp_api_key', 'whatsapp_verify_token', 'gemini_api_key', 'groq_api_key', 'smtp_pass', 'google_service_account']) {
        if (!payload[k] || payload[k].includes('****')) delete payload[k];
      }
      const res = await fetch('/api/settings/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload })
      });
      const data = await res.json();
      if (data.success) {
        if (!options?.silent) {
          setSuccessMsg('Configuraciones guardadas y aplicadas con éxito.');
          window.setTimeout(() => setSuccessMsg(null), 10000);
        }
        // Apply theme color immediately to browser HTML node
        document.documentElement.className = `h-full bg-[#090b11] theme-${configs.appearance_accent} ${configs.appearance_mode}`;
      } else {
        throw new Error(data.error || 'Error al guardar');
      }
    } catch (err: any) {
      if (!options?.silent) {
        setErrorMsg(err.message || 'Error al conectar con la API.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0f1d] text-slate-100">
      
      {/* Compact Top Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-[#0c0f1d] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/15">
            <Settings className="h-4 w-4" />
          </div>
          <h1 className="text-sm font-bold text-white tracking-wide">Configuración</h1>
        </div>
        <button 
          onClick={fetchConfigs}
          disabled={fetching}
          className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-800 text-slate-400 hover:text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-50"
          title="Refrescar configuraciones"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Internal Sidebar Menu (Organizado Profesional - Mismo Fondo que Columna 1) */}
        <div className="w-64 bg-[#0c0f1d] border-r border-slate-800 p-5 space-y-6 overflow-y-auto shrink-0 select-none">
          
          <div className="space-y-1">
            <button
              onClick={() => setActiveSection('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                activeSection === 'overview' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Grid size={16} className={activeSection === 'overview' ? 'text-emerald-400' : 'text-slate-500'} />
              <span>Resumen General</span>
            </button>
          </div>

          {/* Categoría: Identidad y Marca */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-slate-500 tracking-widest uppercase block pl-2">
              Identidad de Empresa
            </span>
            <div className="space-y-1">
              {[
                { id: 'profile', label: 'Marca & Identidad', icon: Sparkles },
                { id: 'appearance', label: 'Apariencia Visual', icon: Palette }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={15} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.id === 'appearance' && (
                      <span className="text-[10px] text-slate-500 capitalize shrink-0 ml-1">{selectedMode}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categoría: Conexiones y Automatización */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-slate-500 tracking-widest uppercase block pl-2">
              Automatización & API
            </span>
            <div className="space-y-1">
              {[
                { id: 'whatsapp', label: 'Conexión WhatsApp', icon: MessageSquare },
                { id: 'ai', label: 'Ajustes de IA & RAG', icon: Bot },
                { id: 'smtp', label: 'Servidor Alertas SMTP', icon: Mail },
                { id: 'system', label: 'Configuración General', icon: Settings }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={15} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.id === 'smtp' && configs.smtp_host && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono shrink-0 ml-1">
                        activo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Panel Content (Mismo Fondo que Columna 1) */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#0c0f1d] relative">

          {fetching ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-400 mx-auto" />
              <p className="text-slate-400 text-xs font-medium">Obteniendo configuraciones de la base de datos...</p>
            </div>
          ) : (
            <div className="w-full max-w-[1350px] mx-auto">
              
              {/* 1. OVERVIEW VIEW */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* User Header Block */}
                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {configs.user_avatar ? (
                        <img 
                          src={configs.user_avatar} 
                          alt="Avatar" 
                          className="h-12 w-12 rounded-full object-cover border border-[#1e2330]" 
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-extrabold text-base">
                          {configs.display_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h2 className="text-base font-bold text-white">{configs.display_name}</h2>
                        <p className="text-xs text-slate-400">{configs.admin_email || 'admin@sudominio.com'}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 tracking-wider uppercase">Propietario</span>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'profile', label: 'Marca & Identidad del Negocio', icon: Sparkles, desc: 'Nombre de tu empresa y logo' },
                      { id: 'whatsapp', label: 'API de WhatsApp', icon: MessageSquare, desc: 'Conexión a Meta o Evolution API' },
                      { id: 'ai', label: 'Ajustes de IA', icon: Bot, desc: 'Gestión de Gemini API Key y RAG' },
                      { id: 'smtp', label: 'Servidor SMTP', icon: Mail, desc: 'Servidor de envío de alertas' },
                      { id: 'appearance', label: 'Apariencia', icon: Palette, desc: 'Tema oscuro / claro y colores' }
                    ].map((card) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={card.id}
                          onClick={() => setActiveSection(card.id as any)}
                          className="p-5 bg-[#0f111a] border border-[#1e2330] hover:border-[#2a3040] rounded-xl text-left transition duration-300 hover:bg-[#131622] group"
                        >
                          <div className="flex justify-between items-center mb-3">
                            <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 rounded-lg text-indigo-400 group-hover:text-indigo-300">
                              <Icon size={16} />
                            </div>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition transform group-hover:translate-x-0.5" />
                          </div>
                          <span className="text-xs font-bold text-white block mb-0.5">{card.label}</span>
                          <span className="text-[10px] text-slate-400 block">{card.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BRANDING & BUSINESS IDENTITY VIEW (PERFIL & MARCA) */}
              {(activeSection === 'branding' || activeSection === 'profile') && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Marca & Identidad del Negocio</h2>
                    <p className="text-xs text-slate-400">Personaliza el logo de tu empresa para que aparezca en la barra lateral del CRM.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    {/* Previsualización en Tiempo Real */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-2">Previsualización de tu Cabecera Lateral</label>
                      <div className="w-64 p-3 bg-[#0c0f1d] border border-slate-800 rounded-xl flex items-center gap-3">
                        {brandingLogoUrl ? (
                          <img 
                            src={brandingLogoUrl} 
                            alt="Logo" 
                            className="w-9 h-9 rounded-xl object-contain bg-slate-900 p-1 border border-slate-800" 
                          />
                        ) : (
                          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
                            <Sparkles className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h1 className="font-bold text-sm text-white truncate">{brandingCompanyName || 'Tu Empresa'}</h1>
                          <p className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase truncate">
                            Desarrollado por L. Milla
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Formulario */}
                    <div className="space-y-4 pt-4 border-t border-[#1e2330]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-300 block">Nombre de tu Empresa / Negocio</label>
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
                            <Lock size={10} /> Fijado por Licencia
                          </span>
                        </div>
                        <input 
                          type="text"
                          value={brandingCompanyName}
                          disabled
                          readOnly
                          className="w-full px-3 py-2.5 bg-[#12141c] border border-[#232838] rounded-lg text-xs text-slate-400 cursor-not-allowed font-semibold shadow-inner"
                        />
                        <span className="text-[10px] text-slate-500 block">El nombre de la empresa queda sellado permanentemente con el serial de la licencia y la placa madre del equipo.</span>
                      </div>

                      {/* Cargar Logo desde la Computadora (1-Clic) */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300 block">Logo de tu Empresa / Negocio</label>
                        
                        <input
                          type="file"
                          ref={logoFileInputRef}
                          onChange={handleLogoFileUpload}
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                          className="hidden"
                        />

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                          >
                            <Upload size={14} />
                            <span>Subir Logo desde mi Computadora</span>
                          </button>
                          
                          {brandingLogoUrl && (
                            <button
                              type="button"
                              onClick={() => setBrandingLogoUrl('')}
                              className="text-xs text-rose-400 hover:text-rose-300 font-medium underline"
                            >
                              Quitar logo actual
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">Formatos recomendados: PNG o JPG con fondo transparente o cuadrado.</span>
                      </div>

                      {/* Opción Avanzada: URL directa */}
                      <div className="pt-2">
                        <details className="text-xs text-slate-500 cursor-pointer">
                          <summary className="hover:text-slate-400 font-medium mb-2">Opción avanzada (Usar enlace URL externo)</summary>
                          <input 
                            type="text"
                            value={brandingLogoUrl}
                            onChange={(e) => setBrandingLogoUrl(e.target.value)}
                            placeholder="https://su-dominio.com/logo.png"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono mt-1"
                          />
                        </details>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={handleSaveBranding}
                        disabled={savingBranding}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition disabled:opacity-50"
                      >
                        <Save size={13} />
                        <span>{savingBranding ? 'Guardando...' : 'Guardar Marca'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}





              {/* 4. APPEARANCE VIEW */}
              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Apariencia</h2>
                    <p className="text-xs text-slate-400">Elige el tema visual del CRM y los colores de énfasis aplicados en los botones, menús y barras activas.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-6">
                    
                    {/* Theme Mode Selector */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-white block">Tema</span>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'light', label: 'Modo Claro', desc: 'Vista clásica clara' },
                          { id: 'dark', label: 'Modo Oscuro', desc: 'Fondo oscuro premium' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleAppearanceUpdate(m.id as any, selectedAccent)}
                            className={`p-4 rounded-xl border text-left transition duration-300 ${
                              selectedMode === m.id 
                                ? 'bg-[#181d2f] border-indigo-500 shadow-md' 
                                : 'bg-[#161922] border-[#2a3040] hover:bg-[#1a1f2b]'
                            }`}
                          >
                            <span className="text-xs font-semibold text-white block">{m.label}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Style / Theme Selector (Solo 2: Actual y Neón Glass) */}
                    <div className="space-y-3 pt-6 border-t border-[#1e2330]">
                      <div>
                        <span className="text-xs font-bold text-white block">Estilo Visual y Acentos</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Elige entre el estilo clásico oficial de Fuxion o el nuevo diseño Neón Glass transparente.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { 
                            id: 'emerald', 
                            label: 'Esmeralda Fuxion (Estilo Actual)', 
                            badge: 'OFICIAL',
                            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                            color: '#10b981', 
                            desc: 'Tema clásico empresarial oscuro con toques verde esmeralda Fuxion y tarjetas sólidas limpias.' 
                          },
                          { 
                            id: 'neon-glass', 
                            label: 'Neón Glass (Transparente)', 
                            badge: 'NUEVO',
                            badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
                            color: '#00d2ff', 
                            desc: 'Marco de tubo neón cian resplandeciente, cuerpo de cristal ahumado transparente (glassmorphism) y glow cibernético.' 
                          }
                        ].map((c) => {
                          const isSelected = selectedAccent === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleAppearanceUpdate(selectedMode, c.id)}
                              className={`p-4 rounded-xl border text-left transition duration-300 relative overflow-hidden group cursor-pointer ${
                                isSelected 
                                  ? c.id === 'neon-glass'
                                    ? 'bg-[#050811]/70 border-cyan-400 shadow-[0_0_20px_rgba(0,210,255,0.4)] ring-1 ring-cyan-400 backdrop-blur-xl'
                                    : 'bg-[#181d2f] border-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500' 
                                  : 'bg-[#161922] border-slate-800 hover:bg-[#1a1f2b] hover:border-slate-700 opacity-60 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2.5">
                                  <div 
                                    className="h-3.5 w-3.5 rounded-full shrink-0" 
                                    style={{ backgroundColor: c.color, boxShadow: `0 0 10px ${c.color}` }}
                                  />
                                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{c.label}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${c.badgeColor}`}>
                                  {c.badge}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed mt-1">{c.desc}</p>
                              {isSelected && (
                                <div 
                                  className="absolute bottom-0 left-0 right-0 h-1" 
                                  style={{ backgroundColor: c.color, boxShadow: `0 0 10px ${c.color}` }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selector de Escala de Tipografía y Accesibilidad */}
                    <div className="space-y-3 pt-6 border-t border-[#1e2330]">
                      <span className="text-xs font-bold text-white block">Escala de Fuente y Legibilidad</span>
                      <p className="text-[11px] text-slate-400">Ajusta el tamaño global del texto para mayor comodidad visual. La interfaz recalcula automáticamente los espacios y paddings para evitar amontonamiento.</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'compact', label: 'Compacto (100%)', desc: 'Tamaño estándar optimizado para monitores de alta densidad de datos.' },
                          { id: 'medium', label: 'Medio (112%)', desc: 'Texto más grande con espaciado y márgenes proporcionales.' },
                          { id: 'large', label: 'Grande (125%)', desc: 'Máxima legibilidad y descanso visual sin deformar tarjetas ni botones.' }
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('crm_font_size', s.id);
                                document.documentElement.classList.remove('font-size-compact', 'font-size-medium', 'font-size-large');
                                document.documentElement.classList.add(`font-size-${s.id}`);
                              }
                            }}
                            className="p-4 rounded-xl border bg-[#161922] border-[#2a3040] hover:border-indigo-500 hover:bg-[#1a1f2b] text-left transition duration-300"
                          >
                            <span className="text-xs font-bold text-white block mb-1">Aa {s.label}</span>
                            <span className="text-[10px] text-slate-400 block leading-relaxed">{s.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Aplicar Apariencia</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 5. WHATSAPP CONNECTION VIEW */}
              {activeSection === 'whatsapp' && (
                <div className="space-y-6">
                  
                  {/* Outer Grid to display settings and help together */}
                  <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Form block */}
                    <div className="flex-1 space-y-6">
                      <div>
                        <h2 className="text-base font-bold text-white mb-1">Conexión de WhatsApp</h2>
                        <p className="text-xs text-slate-400">Conecta tu cuenta de Meta WhatsApp Business API o Evolution API para automatizaciones avanzadas.</p>
                      </div>

                      <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        
                        {/* URL API */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">URL de API de WhatsApp</label>
                          <input 
                            type="url"
                            placeholder="https://graph.facebook.com"
                            value={configs.whatsapp_api_url}
                            onChange={(e) => handleInputChange('whatsapp_api_url', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Token */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Permanent Access Token (Meta) / API Key (Evolution){secretMeta.configured['whatsapp_api_key'] ? ' (configurado)' : ''}</label>
                          <input 
                            type="password"
                            placeholder={secretMeta.masked['whatsapp_api_key'] || 'EAAGb342r... (vacío = conservar)'}
                            value={configs.whatsapp_api_key}
                            onChange={(e) => handleInputChange('whatsapp_api_key', e.target.value)}
                            autoComplete="new-password"
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
                          />
                        </div>

                        {/* Instancia / Phone ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Phone Number ID (Meta) / Instancia (Evolution)</label>
                          <input 
                            type="text"
                            placeholder="100234567890123"
                            value={configs.whatsapp_instance}
                            onChange={(e) => handleInputChange('whatsapp_instance', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Business Account ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">WhatsApp Business Account ID (Opcional - Meta)</label>
                          <input 
                            type="text"
                            placeholder="100234567890456"
                            value={configs.whatsapp_business_id}
                            onChange={(e) => handleInputChange('whatsapp_business_id', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Webhook Token Verify */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Webhook Verify Token</label>
                          <input 
                            type="text"
                            placeholder="fuxion_verify_token"
                            value={configs.whatsapp_verify_token}
                            onChange={(e) => handleInputChange('whatsapp_verify_token', e.target.value)}
                            className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
                          />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                          <button
                            onClick={() => handleSubmit()}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                          >
                            <Save size={13} />
                            <span>Guardar Ajustes de WhatsApp</span>
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Instruction accordion side block */}
                    <div className="w-full lg:w-80 space-y-4">
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={16} className="text-indigo-400" />
                          <span className="text-xs font-bold text-white">Instrucciones de Configuración</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Sigue estos pasos para conectar tu Meta WhatsApp Business API:
                        </p>

                        <div className="space-y-3 text-[10px] text-slate-400">
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040]">
                            <span className="font-bold text-white block mb-0.5">1. Crea una app de Meta</span>
                            Crea una cuenta en developers.facebook.com y crea una aplicación tipo "Negocios" agregando el producto "WhatsApp".
                          </div>
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040]">
                            <span className="font-bold text-white block mb-0.5">2. Obtén tus credenciales</span>
                            Copia tu ID de número de teléfono y pégalo arriba como "Phone Number ID". Genera un Token de Acceso Permanente.
                          </div>
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040]">
                            <span className="font-bold text-white block mb-0.5">3. Configura el Webhook</span>
                            En Meta, ingresa la URL de tu CRM seguida de <code className="bg-slate-900 px-1 py-0.2 rounded text-indigo-300 font-mono">/api/webhook/whatsapp</code> y usa el Verify Token de arriba.
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 6. AI SETTINGS VIEW (Compact 2-Column Manager Max 4 Keys + Anti-Ban Guide) */}
              {activeSection === 'ai' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Ajustes & Motores de IA</h2>
                    <p className="text-xs text-slate-400">Gestiona hasta 4 claves de API en cascada automática de prioridad. Si una clave se agota, el sistema conmuta suavemente a la siguiente.</p>
                  </div>

                  {/* Top Bar Switch: Global AI Toggle */}
                  <div className="p-4 bg-[#0f111a] border border-[#1e2330] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Cpu size={20} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">Respuestas Automáticas de IA</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Si se desactiva, el bot se pausará y responderá únicamente mediante flujos visuales o agentes humanos.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = configs.ai_enabled === 'true' ? 'false' : 'true';
                        handleInputChange('ai_enabled', nextVal);
                        handleSubmit(undefined, { silent: true });
                      }}
                      className={`transition ${configs.ai_enabled === 'true' ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      {configs.ai_enabled === 'true' ? (
                        <ToggleRight size={38} />
                      ) : (
                        <ToggleLeft size={38} />
                      )}
                    </button>
                  </div>

                  {/* Grid 2 Columnas: Formulario + Lista de Claves | Panel Lateral Guía */}
                  <div className="flex flex-col lg:flex-row gap-6">
                    
                    {/* Columna Izquierda: Adición y Lista de Claves */}
                    <div className="flex-1 space-y-6">
                      
                      {/* Card 1: Barra Simple de Pegar API Key (Cero fricción) */}
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-emerald-400" />
                            <h3 className="text-xs font-bold text-white">Conectar Nueva Clave de IA</h3>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {aiKeysList.length} / 4 Claves en Cascada
                          </span>
                        </div>

                        {aiKeysList.length >= 4 ? (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-300 text-xs font-medium">
                            <AlertTriangle size={15} />
                            <span>Has alcanzado el límite máximo de 4 claves. Elimina una de la lista abajo para conectar otra.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-400">
                              Solo pega tu clave de <strong>Google Gemini</strong>, <strong>Groq</strong>, <strong>OpenRouter</strong> u <strong>OpenAI</strong>. El CRM detectará el proveedor, elegirá el mejor modelo oficial y le asignará su nombre automáticamente.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-2 pt-1">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  placeholder="Pega aquí tu API Key (ej: gsk_... / AIzaSy... / sk-...)"
                                  value={newKeyApiKey}
                                  onChange={(e) => handleApiKeyInputChange(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddAiKey();
                                    }
                                  }}
                                  className="w-full pl-3 pr-24 py-2.5 bg-[#141722] border border-[#2a3040] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono transition"
                                />
                                {newKeyApiKey.trim().length > 0 && (
                                  <span className="absolute right-3 top-2.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                                    {detectProviderFromKey(newKeyApiKey).provider}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={handleAddAiKey}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shrink-0 cursor-pointer"
                              >
                                <Plus size={15} />
                                <span>Agregar Clave</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card 2: Lista de Claves Configuradas (Prioridades #1 a #4) */}
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-white flex items-center gap-2">
                            <Zap size={15} className="text-emerald-400" />
                            Cascada de Claves Configurada (Prioridad de Ejecución)
                          </h3>
                          {savingAiKeys && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold animate-pulse">
                              <RefreshCw size={10} className="animate-spin" /> Guardando...
                            </span>
                          )}
                        </div>

                        {aiKeysList.length === 0 ? (
                          <div className="p-4 bg-[#141722] border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                            <p className="text-xs text-slate-400">No hay claves de IA configuradas.</p>
                            <p className="text-[10px] text-slate-500">Agrega tu primera API Key arriba para activar las respuestas automáticas.</p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {aiKeysList.map((item, index) => {
                              const providerColors: { [key: string]: string } = {
                                google: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                                groq: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                                openrouter: 'bg-cyan-500/10 text-cyan-400 border-cyan-400/30',
                                openai: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              };
                              const isShowPass = !!showKeyPassword[item.id];

                              return (
                                <div
                                  key={item.id}
                                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    item.isActive
                                      ? 'bg-[#141724] border-[#252b3d]'
                                      : 'bg-[#11131c]/60 border-[#1c202d] opacity-50'
                                  }`}
                                >
                                  {/* Info de la Clave */}
                                  <div className="flex items-center gap-3">
                                    {/* Prioridad Badge */}
                                    <span className="h-7 w-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-black text-white shrink-0">
                                      #{index + 1}
                                    </span>

                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">{item.name}</span>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.2 rounded border ${providerColors[item.provider] || 'bg-slate-800 text-slate-400'}`}>
                                          {item.provider}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                        <span className="font-mono">
                                          {isShowPass ? item.apiKey : `${item.apiKey.slice(0, 6)}••••••••${item.apiKey.slice(-4)}`}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setShowKeyPassword(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                          className="text-slate-500 hover:text-slate-300"
                                        >
                                          {isShowPass ? <EyeOff size={11} /> : <Eye size={11} />}
                                        </button>
                                        <span className="text-slate-600">•</span>
                                        <span className="text-slate-400 italic">{item.model || 'Auto'}</span>
                                      </div>

                                      {/* Status Test Feedback */}
                                      {keyTestStatus[item.id] && (
                                        <div className={`text-[10px] flex items-center gap-1.5 font-medium ${
                                          keyTestStatus[item.id].success ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                          {keyTestStatus[item.id].success ? <CheckCircle size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                                          <span>{keyTestStatus[item.id].message}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Controles de Acción (Test, Orden, ON/OFF, Borrar) */}
                                  <div className="flex items-center gap-2 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1e2330]">
                                    {/* Botón Probar Clave */}
                                    <button
                                      type="button"
                                      disabled={testingKeyId === item.id}
                                      onClick={() => handleTestAiKey(item)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:text-indigo-200 text-[10px] font-bold transition disabled:opacity-50"
                                      title="Probar conexión en tiempo real con este proveedor"
                                    >
                                      <Zap size={11} className={testingKeyId === item.id ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
                                      <span>{testingKeyId === item.id ? 'Probando...' : 'Probar'}</span>
                                    </button>

                                    {/* Subir/Bajar Prioridad */}
                                    <div className="flex items-center bg-[#0c0e18] rounded-lg border border-[#222838] p-0.5">
                                      <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={() => handleMovePriority(index, 'up')}
                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                                        title="Subir Prioridad"
                                      >
                                        <ChevronUp size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={index === aiKeysList.length - 1}
                                        onClick={() => handleMovePriority(index, 'down')}
                                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                                        title="Bajar Prioridad"
                                      >
                                        <ChevronDown size={13} />
                                      </button>
                                    </div>

                                    {/* Switch ON/OFF */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAiKey(item.id)}
                                      className={`text-[10px] font-bold px-2 py-1 rounded transition ${
                                        item.isActive
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                                      }`}
                                    >
                                      {item.isActive ? 'ACTIVO' : 'PAUSADO'}
                                    </button>

                                    {/* Borrar */}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAiKey(item.id)}
                                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                                      title="Eliminar Clave"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Card 3: DIRECTIVAS & REGLAS DE COMPORTAMIENTO */}
                      <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Sparkles size={15} className="text-emerald-400" />
                              Directivas & Reglas de Comportamiento de IA
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Define parámetros dinámicos (instrucciones, tono, límites y reglas de venta) que las IAs acatarán en tiempo real.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddRuleModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
                          >
                            <Plus size={14} />
                            <span>Agregar Regla</span>
                          </button>
                        </div>

                        {/* Filtros de Categoría */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {['Todas', 'Tono y Estilo', 'Reglas de Venta', 'Logística y Pagos', 'Promociones', 'Restricciones'].map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedRuleCategoryFilter(cat)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                                selectedRuleCategoryFilter === cat
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-[#161922] text-slate-400 border border-[#2a3040] hover:text-white'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        {/* Lista de Tarjetas de Reglas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                          {aiRules.length === 0 ? (
                            <div className="col-span-full p-6 text-center bg-[#161922] border border-[#2a3040] rounded-xl text-slate-400 text-xs">
                              No hay reglas configuradas aún. Haz clic en "Agregar Regla" para añadir la primera directiva.
                            </div>
                          ) : (
                            aiRules
                              .filter(r => selectedRuleCategoryFilter === 'Todas' || r.category === selectedRuleCategoryFilter)
                              .map((rule) => (
                                <div
                                  key={rule.id}
                                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                                    rule.is_active
                                      ? 'bg-[#161927] border-emerald-500/30'
                                      : 'bg-[#131620]/60 border-[#222838] opacity-60'
                                  }`}
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {rule.category || 'General'}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRuleActive(rule.id, rule.is_active)}
                                          className={`text-xs font-semibold px-2 py-0.5 rounded transition ${
                                            rule.is_active
                                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                                          }`}
                                        >
                                          {rule.is_active ? 'ON' : 'OFF'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditRule(rule)}
                                          className="p-1 text-slate-400 hover:text-emerald-300 transition"
                                          title="Editar regla"
                                        >
                                          <Edit3 size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteRuleItem(rule.id)}
                                          className="p-1 text-slate-500 hover:text-red-400 transition"
                                          title="Eliminar regla"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-200">{rule.title}</h4>
                                    <p className="text-[11px] text-slate-400 leading-relaxed italic bg-[#0c0e18] p-2 rounded-lg border border-slate-900">
                                      "{rule.instruction}"
                                    </p>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Columna Derecha: Guía Paso a Paso & Protección Anti-Baneo */}
                    <div className="w-full lg:w-80 space-y-4">
                      
                      {/* Card 1: Guía de Obtención de Claves */}
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={16} className="text-emerald-400" />
                          <span className="text-xs font-bold text-white">Guía Paso a Paso (Gratis)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Sigue estos pasos para obtener tus API Keys gratuitas en menos de 2 minutos:
                        </p>

                        <div className="space-y-3 text-[10px] text-slate-400">
                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040] space-y-1">
                            <span className="font-bold text-emerald-400 block">1. Google Gemini (15 RPM / 1,500 RPD Gratis)</span>
                            <p>Ingresa a <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-mono">aistudio.google.com</a> con tu Gmail, haz clic en "Get API key" y pégala aquí.</p>
                          </div>

                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040] space-y-1">
                            <span className="font-bold text-amber-400 block">2. Groq Llama-3 (30 RPM Gratis)</span>
                            <p>Crea una cuenta gratis en <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-amber-400 underline font-mono">console.groq.com</a>, genera tu API Key y añádela como Prioridad #2.</p>
                          </div>

                          <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040] space-y-1">
                            <span className="font-bold text-cyan-400 block">3. OpenRouter (Multimodelo Auto)</span>
                            <p>Regístrate en <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-mono">openrouter.ai</a> para acceder a modelos de respaldo automáticos.</p>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Salvaguardas Anti-Baneo */}
                      <div className="p-5 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <ShieldAlert size={16} className="text-emerald-400" />
                          <span className="text-xs font-bold text-white">Protección Anti-Baneo Integrada</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          NutraFlow CRM aplica 3 capas de protección para evitar bloqueos de cuenta:
                        </p>

                        <ul className="space-y-2 text-[10px] text-slate-300">
                          <li className="flex items-start gap-1.5">
                            <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span><strong>Ritmo Humano (Delay 1.5s):</strong> Micro-pausas entre respuestas de WhatsApp.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span><strong>Control de Tasa Preventivo:</strong> Conmuta suavemente al siguiente respaldo antes de agotar cuotas.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span><strong>Policy Guard:</strong> Prompts con filtro seguro de lenguaje médico y comercial.</span>
                          </li>
                        </ul>
                      </div>

                    </div>

                  </div>
                </div>
              )}

              {/* MODAL PARA AGREGAR / EDITAR REGLA DE IA */}
              {showAddRuleModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0f111a] border border-[#1e2330] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between border-b border-[#1e2330] pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-emerald-400" />
                        <h3 className="text-sm font-bold text-white">{editingRuleId ? 'Editar Regla de IA' : 'Nueva Regla de IA'}</h3>
                      </div>
                      <button
                        onClick={() => {
                          setShowAddRuleModal(false);
                          setEditingRuleId(null);
                          setNewRuleTitle('');
                          setNewRuleInstruction('');
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <form onSubmit={handleSaveRule} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Título de la Regla</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Formato Corto de Mensajes"
                          value={newRuleTitle}
                          onChange={(e) => setNewRuleTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Categoría</label>
                        <select
                          value={newRuleCategory}
                          onChange={(e) => setNewRuleCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Tono y Estilo">Tono y Estilo</option>
                          <option value="Reglas de Venta">Reglas de Venta</option>
                          <option value="Logística y Pagos">Logística y Pagos</option>
                          <option value="Promociones">Promociones</option>
                          <option value="Restricciones">Restricciones</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Instrucción / Parámetro</label>
                        <textarea
                          rows={4}
                          required
                          placeholder="Ej. Nunca dar listas de ingredientes. Responder en máximo 30 palabras de forma empática."
                          value={newRuleInstruction}
                          onChange={(e) => setNewRuleInstruction(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2330]">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddRuleModal(false);
                            setEditingRuleId(null);
                            setNewRuleTitle('');
                            setNewRuleInstruction('');
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg transition shadow-md"
                        >
                          Guardar Regla
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 7. SMTP VIEW */}
              {activeSection === 'smtp' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white mb-1">Servidor SMTP</h2>
                    <p className="text-xs text-slate-400">Configura tus servidores de salida de correo para el envío de alertas automáticas.</p>
                  </div>

                  {/* TARJETA INFORMATIVA GUÍA SMTP */}
                  <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 font-bold text-indigo-300">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Guía de Configuración Rápida para Gmail & Correos Corporativos</span>
                    </div>

                    <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed pl-1">
                      <p>
                        <strong className="text-white">1. Si usas Gmail (Recomendado):</strong>
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-slate-300">
                        <li><strong>Host:</strong> <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">smtp.gmail.com</code> | <strong>Puerto:</strong> <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">587</code></li>
                        <li><strong>Contraseña SMTP:</strong> Google bloquea las contraseñas normales por seguridad. Debes usar una <strong>Contraseña de Aplicación (16 caracteres)</strong> generada gratis en tu cuenta de Google (<a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold hover:text-indigo-300">myaccount.google.com/apppasswords</a>).</li>
                      </ul>

                      <p className="pt-1">
                        <strong className="text-white">2. Si usas Outlook / Hotmail:</strong> Host: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">smtp.office365.com</code> | Puerto: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">587</code>
                      </p>

                      <p className="pt-1">
                        <strong className="text-white">3. Pruebas en 1 Clic:</strong> Al terminar de llenar tus datos, haz clic en <strong>"🧪 Enviar Correo de Prueba"</strong> para confirmar que recibes la alerta en tu correo.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-medium text-slate-300 block">Host SMTP</label>
                        <input 
                          type="text"
                          placeholder="smtp.gmail.com"
                          value={configs.smtp_host}
                          onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Puerto</label>
                        <input 
                          type="text"
                          placeholder="587"
                          value={configs.smtp_port}
                          onChange={(e) => handleInputChange('smtp_port', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Usuario SMTP</label>
                        <input 
                          type="text"
                          placeholder="su-correo@gmail.com"
                          value={configs.smtp_user}
                          onChange={(e) => handleInputChange('smtp_user', e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300 block">Contraseña SMTP{secretMeta.configured['smtp_pass'] ? ' (configurada)' : ''}</label>
                        <input 
                          type="password"
                          placeholder={secretMeta.masked['smtp_pass'] || '•••••••••••• (vacío = conservar)'}
                          value={configs.smtp_pass}
                          onChange={(e) => handleInputChange('smtp_pass', e.target.value)}
                          autoComplete="new-password"
                          className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300 block">Email Remite (From)</label>
                      <input 
                        type="text"
                        placeholder='"Alertas FUXION" <alertas@gmail.com>'
                        value={configs.smtp_from}
                        onChange={(e) => handleInputChange('smtp_from', e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#161922] border border-[#2a3040] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#1e2330]">
                      <button
                        type="button"
                        onClick={handleTestEmail}
                        disabled={testingEmail || loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1c2333] hover:bg-[#252e42] border border-indigo-500/30 text-xs font-bold text-indigo-300 rounded-lg transition disabled:opacity-50"
                      >
                        <Mail size={13} className={testingEmail ? 'animate-bounce text-emerald-400' : ''} />
                        <span>{testingEmail ? 'Enviando Prueba...' : '🧪 Enviar Correo de Prueba'}</span>
                      </button>

                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-lg transition"
                      >
                        <Save size={13} />
                        <span>Guardar Ajustes SMTP</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 8. SYSTEM VIEW */}
              {activeSection === 'system' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-white mb-1.5">Ajustes Generales</h2>
                    <p className="text-sm text-slate-300 font-medium">Configuraciones de administración y notificaciones operacionales.</p>
                  </div>

                  <div className="p-6 bg-[#0f111a] border border-[#1e2330] rounded-2xl space-y-6 shadow-xl">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-200 block">Correo del Administrador</label>
                      <input 
                        type="email"
                        placeholder="ejemplo@sudominio.com"
                        value={configs.admin_email}
                        onChange={(e) => handleInputChange('admin_email', e.target.value)}
                        className="w-full px-4 py-3 bg-[#131622] border border-[#2e364a] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner font-medium"
                      />
                      <span className="text-xs text-slate-300 font-medium mt-1.5 block leading-normal">
                        Dirección de correo a donde se enviarán las alertas automáticas de WhatsApp, comprobantes de pago y avisos de asesor.
                      </span>
                    </div>

                      {/* TARJETA GOOGLE SHEETS */}
                      <div className="pt-4 border-t border-[#1e2330] space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">📊 Google Sheets</span>
                          <label className="text-sm font-bold text-white block">Sincronización con Google Sheets</label>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">ID de la hoja (API oficial)</label>
                          <input
                            type="text"
                            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                            value={configs.google_sheet_id}
                            onChange={(e) => handleInputChange('google_sheet_id', e.target.value)}
                            className="w-full px-4 py-3 bg-[#131622] border border-[#2e364a] rounded-xl text-sm text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner font-mono"
                          />
                          <span className="text-xs text-slate-300 font-medium block leading-normal">
                            Son los caracteres entre <code className="text-indigo-300 font-mono">/d/</code> y <code className="text-indigo-300 font-mono">/edit</code> de la URL de tu hoja. Compártela como Editor con el email de tu cuenta de servicio.
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">Cuenta de servicio (JSON){secretMeta.configured['google_service_account'] ? ' (configurada)' : ''}</label>
                          <textarea
                            rows={3}
                            placeholder={secretMeta.masked['google_service_account'] || '{"type": "service_account", ...} (vacío = conservar)'}
                            value={configs.google_service_account}
                            onChange={(e) => handleInputChange('google_service_account', e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full px-4 py-3 bg-[#131622] border border-[#2e364a] rounded-xl text-xs text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner font-mono resize-y"
                          />
                          <span className="text-xs text-slate-300 font-medium block leading-normal">
                            Pega el contenido completo del archivo JSON descargado de Google Cloud. Con esto la sincronización usa la API oficial (más rápida y sin Apps Script).
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300 block">URL del Webhook (respaldo, opcional)</label>
                          <input
                            type="url"
                            placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                            value={configs.google_sheets_url}
                            onChange={(e) => handleInputChange('google_sheets_url', e.target.value)}
                            className="w-full px-4 py-3 bg-[#131622] border border-[#2e364a] rounded-xl text-sm text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner font-mono"
                          />
                          <p className="text-xs text-slate-300 font-medium leading-relaxed">
                            Solo se usa si la API oficial no está configurada. Al presionar <strong>"📊 Guardar en Google Sheets"</strong> en la pantalla principal o Kanban, tus contactos se sincronizan automáticamente.
                          </p>
                        </div>
                      </div>

                    <div className="p-5 bg-[#131724] border border-[#2a3248] rounded-xl text-xs text-slate-200 leading-relaxed font-medium shadow-sm">
                      <span className="font-bold text-white text-sm block mb-1.5">Base de datos en uso:</span>
                      El sistema está operando con almacenamiento híbrido en caliente. Si las variables globales de Supabase están configuradas en el entorno, los datos de los Ajustes se guardarán de forma centralizada en la base de datos de PostgreSQL en la nube. De lo contrario, se guardarán de forma local en tu base de datos SQLite encapsulada en <code className="text-indigo-300 font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">db.sqlite</code>.
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[#1e2330]">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white rounded-xl transition shadow-lg"
                      >
                        <Save size={15} />
                        <span>Guardar Ajustes Generales</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* BANNER FLOTANTE DE NOTIFICACIÓN PROFESIONAL EN EL ESPACIO INFERIOR */}
      {(successMsg || errorMsg) && (
        <div className="fixed bottom-6 right-8 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start justify-between gap-3 ${
            successMsg 
              ? 'bg-[#0c1a15]/95 border-emerald-500/40 text-emerald-200 shadow-emerald-500/10' 
              : 'bg-[#1f0f16]/95 border-rose-500/40 text-rose-200 shadow-rose-500/10'
          }`}>
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {successMsg ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">
                  {successMsg ? 'Operación Exitosa' : 'Aviso del Sistema'}
                </h4>
                <p className="text-xs leading-relaxed break-words font-medium text-slate-200">
                  {successMsg || errorMsg}
                </p>
              </div>
            </div>

            <button
              onClick={() => { setSuccessMsg(null); setErrorMsg(null); }}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition shrink-0 hover:bg-white/10"
              title="Cerrar notificación"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
