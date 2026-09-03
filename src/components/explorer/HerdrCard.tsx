import { useMemo, useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, Pill, SourceBadge, Term } from "./ui";

export interface HerdrPluginAction {
  id: string;
  title: string;
  description?: string;
}

export interface HerdrPlugin {
  id: string;
  name: string;
  version: string;
  minHerdrVersion?: string;
  description: string;
  enabled: boolean;
  platforms: string[];
  actions: HerdrPluginAction[];
  sourceKind: string;
  sourceRepo?: string;
}

export interface HerdrKeyCommand {
  key: string;
  type: string;
  command: string;
  description: string;
}

export interface HerdrConfigSummary {
  prefix: string;
  theme: string;
  accent: string;
  agentPanelSort: string;
  resumeAgents: boolean;
  worktreesDir: string;
  supportedAgents: string[];
  keyCommands: HerdrKeyCommand[];
  agentKeybinds: Array<{ action: string; key: string }>;
}

export interface HerdrCardData {
  configSource: "live" | "fallback";
  pluginsSource: "live" | "fallback";
  config: HerdrConfigSummary;
  plugins: HerdrPlugin[];
  rawConfig: string;
  rawPlugins: string;
}

type TabMode = "orchestration" | "plugins" | "raw";
type SourceToggle = "served" | "fallback";

export default function HerdrCard() {
  const { data, error } = useJson<HerdrCardData>("/api/cards/herdr");

  const [activeTab, setActiveTab] = useState<TabMode>("orchestration");
  const [sourceMode, setSourceMode] = useState<SourceToggle>("served");
  const [disabledPlugins, setDisabledPlugins] = useState<Set<string>>(() => new Set());
  const [pluginQuery, setPluginQuery] = useState("");

  const plugins = data?.plugins ?? [];
  const config = data?.config;

  const isSimulatedFallback = sourceMode === "fallback";
  const displayedConfigSource = isSimulatedFallback ? "fallback" : (data?.configSource ?? "fallback");
  const displayedPluginsSource = isSimulatedFallback ? "fallback" : (data?.pluginsSource ?? "fallback");

  const togglePlugin = (pluginId: string) => {
    setDisabledPlugins((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) next.delete(pluginId);
      else next.add(pluginId);
      return next;
    });
  };

  const filteredPlugins = useMemo(() => {
    const q = pluginQuery.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [plugins, pluginQuery]);

  const enabledCount = plugins.filter(
    (p) => (p.enabled && !disabledPlugins.has(p.id)) || (!p.enabled && disabledPlugins.has(p.id)),
  ).length;

  return (
    <CardShell
      title="Herdr Agent Orchestration"
      blurb="Multi-agent terminal workspace manager — keys, attention queue, and installed plugins."
      badges={
        data ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              <SourceBadge source={displayedConfigSource} />
              <SourceBadge source={displayedPluginsSource} />
            </div>
            {isSimulatedFallback && (
              <span className="rounded border border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-300">
                FALLBACK PREVIEW
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/55">loading herdr configurations…</p>
        )}

        {data && (
          <>
            {/* View navigation and live/fallback toggling toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("orchestration")}
                  aria-pressed={activeTab === "orchestration"}
                  className={`rounded-lg border px-3 py-1 font-mono text-xs transition-colors ${
                    activeTab === "orchestration"
                      ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  orchestration
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("plugins")}
                  aria-pressed={activeTab === "plugins"}
                  className={`rounded-lg border px-3 py-1 font-mono text-xs transition-colors ${
                    activeTab === "plugins"
                      ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  plugins ({plugins.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  aria-pressed={activeTab === "raw"}
                  className={`rounded-lg border px-3 py-1 font-mono text-xs transition-colors ${
                    activeTab === "raw"
                      ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  raw config
                </button>
              </div>

              {/* Live / Fallback Toggle */}
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-white/55">source:</span>
                <button
                  type="button"
                  onClick={() => setSourceMode("served")}
                  aria-pressed={sourceMode === "served"}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    sourceMode === "served"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  served ({data.configSource})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("fallback")}
                  aria-pressed={sourceMode === "fallback"}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    sourceMode === "fallback"
                      ? "border-amber-400/30 bg-amber-400/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  fallback snapshot
                </button>
              </div>
            </div>

            {/* TAB: ORCHESTRATION CONFIG */}
            {activeTab === "orchestration" && config && (
              <div className="space-y-4">
                {/* Orchestration Overview Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                      Prefix & Workspace
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-white">
                      {config.prefix || "ctrl+space"}
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      worktrees: <code className="text-white/70">{config.worktreesDir || "~/.herdr/worktrees"}</code>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                      Agent Attention Queue
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-white capitalize">
                      {config.agentPanelSort || "priority"}
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      needs-input agents sorted first
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                      Session Restore
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold text-emerald-300">
                      {config.resumeAgents ? "active" : "disabled"}
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      resumes agent panes after restart
                    </div>
                  </div>
                </div>

                {/* Agent Harness Inventory */}
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-white/60">
                      Configured Agent Harnesses ({config.supportedAgents.length})
                    </span>
                    <span className="font-mono text-[11px] text-white/55">
                      sidebar row templates
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {config.supportedAgents.map((agent) => (
                      <span
                        key={agent}
                        className="rounded border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 font-mono text-xs text-cyan-200"
                      >
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Keybindings & Commands */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 font-mono text-xs text-white/60">
                      Agent Navigation Binds
                    </div>
                    <ul className="space-y-1.5 font-mono text-xs">
                      {config.agentKeybinds.length > 0 ? (
                        config.agentKeybinds.map((kb) => (
                          <li key={kb.action} className="flex items-center justify-between border-b border-white/5 pb-1">
                            <span className="text-white/70">{kb.action.replace(/_/g, " ")}</span>
                            <span className="rounded bg-white/10 px-2 py-0.5 text-cyan-300">{kb.key}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-white/55">No specific agent keybinds recorded</li>
                      )}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 font-mono text-xs text-white/60">
                      Plugin Custom Keybinds
                    </div>
                    <ul className="space-y-1.5 font-mono text-xs">
                      {config.keyCommands.length > 0 ? (
                        config.keyCommands.map((cmd) => (
                          <li key={cmd.key} className="flex items-center justify-between border-b border-white/5 pb-1">
                            <span className="text-white/70">{cmd.description || cmd.command}</span>
                            <span className="rounded bg-white/10 px-2 py-0.5 text-amber-300">{cmd.key}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-white/55">No custom key commands configured</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PLUGINS LIST */}
            {activeTab === "plugins" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/55">filter</span>
                      <input
                        type="search"
                        aria-label="Filter plugins"
                        value={pluginQuery}
                        onChange={(e) => setPluginQuery(e.target.value)}
                        placeholder="plugin name or id…"
                        className="w-48 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                    <span className="text-emerald-300">{enabledCount}</span>
                    <span>/{plugins.length} active</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                        <th className="px-3 py-2 font-medium">plugin</th>
                        <th className="px-3 py-2 font-medium">version</th>
                        <th className="px-3 py-2 font-medium">status</th>
                        <th className="px-3 py-2 font-medium">actions</th>
                        <th className="px-3 py-2 font-medium">source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlugins.map((plugin) => {
                        const isCurrentlyEnabled =
                          (plugin.enabled && !disabledPlugins.has(plugin.id)) ||
                          (!plugin.enabled && disabledPlugins.has(plugin.id));
                        return (
                          <tr key={plugin.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-white">{plugin.name}</div>
                              <div className="text-[10px] text-white/55">{plugin.id}</div>
                              {plugin.description && (
                                <div className="mt-0.5 text-[11px] text-white/60 font-sans">
                                  {plugin.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-white/80">
                              <div>v{plugin.version}</div>
                              {plugin.minHerdrVersion && (
                                <div className="text-[10px] text-white/55">min v{plugin.minHerdrVersion}</div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => togglePlugin(plugin.id)}
                                aria-pressed={isCurrentlyEnabled}
                                className={`rounded border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
                                  isCurrentlyEnabled
                                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                    : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                                }`}
                              >
                                {isCurrentlyEnabled ? "ENABLED" : "DISABLED"}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              {plugin.actions.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {plugin.actions.map((act) => (
                                    <Pill key={act.id}>{act.title}</Pill>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-white/50">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-white/70">
                              <div>{plugin.sourceKind}</div>
                              {plugin.sourceRepo && (
                                <div className="text-[10px] text-cyan-300">{plugin.sourceRepo}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPlugins.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-center text-white/55" colSpan={5}>
                            {plugins.length === 0 ? "No plugins configured" : `No plugins match "${pluginQuery}"`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: RAW CONFIG PREVIEW */}
            {activeTab === "raw" && (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 font-mono text-xs text-white/60">
                    ~/.config/herdr/config.toml ({displayedConfigSource})
                  </div>
                  <Term>{data.rawConfig}</Term>
                </div>
                <div>
                  <div className="mb-1 font-mono text-xs text-white/60">
                    ~/.config/herdr/plugins.json ({displayedPluginsSource})
                  </div>
                  <Term>{data.rawPlugins}</Term>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CardShell>
  );
}
