-- Fallback snapshot: Hyprland monitor layout (omarchy lua config).
-- Live source: ~/.config/hypr/monitors.lua

local omarchy_gdk_scale = 1

hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))

-- DP-3: Top Left (2K @ 60Hz)
-- Logical Size: 2048x1152 (25% larger UI)
-- Position: Top-left corner (0,0)
hl.monitor({ output = "DP-3", mode = "2560x1440@60", position = "0x0", scale = 1.25, transform = 2 })

-- DP-1: Bottom Left (2K @ 240Hz)
-- Logical Size: 2048x1152
-- Position: Sits exactly under DP-3 (Y = 1152)
hl.monitor({ output = "DP-1", mode = "2560x1440@240", position = "0x1152", scale = 1.25 })

-- DP-2: Bottom Right (4K @ 60Hz)
-- Logical Size: 2048x1152 (Scale 1.875 matches the UI size of your 2K monitors perfectly)
-- Position: Starts after DP-1's 2048 width, perfectly aligned on the same Y-axis (1152)
hl.monitor({ output = "DP-2", mode = "3840x2160@60", position = "2048x1152", scale = 1.875 })
