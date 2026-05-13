import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { Image } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

const GEMINI_AI_ICON_SOURCE = {
  uri:
    "data:image/png;base64,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"
};

function createIcon(name: MaterialIconName) {
  return function Icon({ color = "#637381", size = 20 }: IconProps) {
    return <MaterialCommunityIcons color={color} name={name} size={size} />;
  };
}

export function GeminiAi({ size = 20 }: IconProps) {
  return (
    <Image
      resizeMode="contain"
      source={GEMINI_AI_ICON_SOURCE}
      style={{ height: size, width: size }}
    />
  );
}

export const Archive = createIcon("archive-outline");
export const AccountCircle = createIcon("account-circle-outline");
export const Banknote = createIcon("cash-multiple");
export const Bell = createIcon("bell-outline");
export const Broom = createIcon("broom");
export const CalendarClock = createIcon("calendar-clock-outline");
export const CalendarDays = createIcon("calendar-month-outline");
export const CalendarPlus = createIcon("calendar-plus");
export const CartPlus = createIcon("cart-plus");
export const ChartBar = createIcon("chart-bar");
export const Check = createIcon("check");
export const CheckCircle2 = createIcon("check-circle-outline");
export const ChevronLeft = createIcon("chevron-left");
export const ChevronRight = createIcon("chevron-right");
export const Close = createIcon("close");
export const Cog = createIcon("cog-outline");
export const Database = createIcon("database-outline");
export const DotsVertical = createIcon("dots-vertical");
export const Download = createIcon("download-outline");
export const Eye = createIcon("eye-outline");
export const EyeOff = createIcon("eye-off-outline");
export const FileText = createIcon("file-document-outline");
export const Filter = createIcon("filter-variant");
export const Folder = createIcon("folder-outline");
export const FolderPlus = createIcon("folder-plus-outline");
export const Google = createIcon("google");
export const Home = createIcon("home-outline");
export const Apple = createIcon("apple");
export const Lightbulb = createIcon("lightbulb-outline");
export const ListChecks = createIcon("format-list-checks");
export const Lock = createIcon("lock-outline");
export const LogIn = createIcon("login");
export const LogOut = createIcon("logout");
export const MailPlus = createIcon("email-plus-outline");
export const MoreHorizontal = createIcon("dots-horizontal");
export const NotePlus = createIcon("note-plus-outline");
export const NotebookText = createIcon("notebook-outline");
export const Pencil = createIcon("pencil-outline");
export const Plus = createIcon("plus");
export const ReceiptText = createIcon("receipt");
export const RefreshCcw = createIcon("refresh");
export const Search = createIcon("magnify");
export const ShieldCheck = createIcon("shield-check-outline");
export const ShoppingCart = createIcon("cart-outline");
export const Sparkles = createIcon("auto-fix");
export const Trash2 = createIcon("trash-can-outline");
export const UserPlus = createIcon("account-plus-outline");
export const Users = createIcon("account-group-outline");
export const Utensils = createIcon("silverware-fork-knife");
export const WalletCards = createIcon("wallet-outline");
