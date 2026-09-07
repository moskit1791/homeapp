import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";

import { getMyHousehold } from "../api";
import { useSession } from "../auth/session-context";

const drawerWidth = 272;

const navigation = [
  { label: "Dzisiaj", path: "/", icon: "solar:home-smile-bold-duotone" },
  {
    label: "Kalendarz",
    path: "/kalendarz",
    icon: "solar:calendar-bold-duotone",
  },
  { label: "Zakupy", path: "/zakupy", icon: "solar:cart-3-bold-duotone" },
  { label: "Spiżarnia", path: "/spizarnia", icon: "solar:box-bold-duotone" },
  {
    label: "Plan posiłków",
    path: "/posilki",
    icon: "solar:chef-hat-bold-duotone",
  },
  {
    label: "Zadania i notatki",
    path: "/zadania",
    icon: "solar:checklist-bold-duotone",
  },
  {
    label: "Finanse",
    path: "/finanse",
    icon: "solar:wallet-money-bold-duotone",
  },
  { label: "Dom", path: "/dom", icon: "solar:sofa-2-bold-duotone" },
  {
    label: "Domownicy",
    path: "/domownicy",
    icon: "solar:users-group-rounded-bold-duotone",
  },
];

export function DashboardLayout({
  mode,
  toggleMode,
}: {
  mode: "dark" | "light";
  toggleMode: () => void;
}) {
  const { accessToken, logout } = useSession();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const household = useQuery({
    queryKey: ["household"],
    queryFn: () => getMyHousehold({ accessToken }),
  });

  const drawer = (
    <Stack sx={{ height: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 3 }}>
        <Avatar
          src="/homeapp-icon.png"
          variant="rounded"
          sx={{ width: 42, height: 42 }}
        />
        <Box>
          <Typography variant="h3">HomeApp</Typography>
          <Typography variant="caption" color="text.secondary">
            {household.data?.name ?? "Twój dom"}
          </Typography>
        </Box>
      </Stack>
      <Divider />
      <List sx={{ px: 2, py: 2 }}>
        {navigation.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            end={item.path === "/"}
            onClick={() => setMobileOpen(false)}
            sx={{
              mb: 0.5,
              borderRadius: 1.5,
              color: "text.secondary",
              "&.active": {
                color: "primary.dark",
                bgcolor: "rgba(0,167,111,.12)",
                fontWeight: 700,
              },
              ".MuiListItemIcon-root": { color: "inherit" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Icon icon={item.icon} width={24} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { fontWeight: "inherit" } }}
            />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={() => void logout()}
          sx={{ borderRadius: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Icon icon="solar:logout-2-bold-duotone" width={24} />
          </ListItemIcon>
          <ListItemText primary="Wyloguj się" />
        </ListItemButton>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        color="transparent"
        elevation={0}
        sx={{
          ml: { lg: `${drawerWidth}px` },
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          backdropFilter: "blur(12px)",
          bgcolor:
            mode === "dark" ? "rgba(20,26,33,.78)" : "rgba(244,246,248,.72)",
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          {!desktop && (
            <IconButton
              onClick={() => setMobileOpen(true)}
              aria-label="Otwórz menu"
            >
              <Icon icon="solar:hamburger-menu-bold" />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === "dark" ? "Tryb jasny" : "Tryb ciemny"}>
            <IconButton onClick={toggleMode}>
              <Icon
                icon={
                  mode === "dark"
                    ? "solar:sun-2-bold-duotone"
                    : "solar:moon-bold-duotone"
                }
              />
            </IconButton>
          </Tooltip>
          <Tooltip title={household.data?.name ?? "Dom"}>
            <Avatar
              sx={{ ml: 1, bgcolor: "primary.main", width: 36, height: 36 }}
            >
              {household.data?.name?.slice(0, 1).toUpperCase() ?? "H"}
            </Avatar>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={desktop ? "permanent" : "temporary"}
        open={desktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: drawerWidth,
              borderRight: "1px dashed",
              borderColor: "divider",
            },
          },
        }}
      >
        {drawer}
      </Drawer>
      <Box
        component="main"
        sx={{
          ml: { lg: `${drawerWidth}px` },
          pt: 12,
          pb: 6,
          px: { xs: 2, sm: 3, xl: 5 },
        }}
      >
        <Box sx={{ maxWidth: 1440, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
