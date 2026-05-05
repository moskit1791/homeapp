import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type IconProps = {
  color?: string;
  size?: number;
  strokeWidth?: number;
};

function createIcon(name: MaterialIconName) {
  return function Icon({ color = "#637381", size = 20 }: IconProps) {
    return <MaterialCommunityIcons color={color} name={name} size={size} />;
  };
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
