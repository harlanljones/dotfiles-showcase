-- Fallback snapshot: Hyprland monitor layout (omarchy lua config).
-- Live source: ~/.config/hypr/monitors.lua

local omarchy_gdk_scale = 1

hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))

-- Secondary: 32" 4K 60Hz on the left
hl.monitor({ output = "DP-1", mode = "3840x2160@60", position = "0x0", scale = 1.6 })

-- Primary: 27" 2K 240Hz on the right, centered at same height as 4K monitor
hl.monitor({ output = "DP-2", mode = "2560x1440@240", position = "3840x360", scale = 1.25 })
