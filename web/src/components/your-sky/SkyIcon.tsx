import type { SVGProps } from "react";
import {
  ArrowRightIcon, CameraIcon, ChevronDownIcon, ChevronRightIcon,
  Cross2Icon, GlobeIcon, ImageIcon, MagnifyingGlassIcon,
  MoonIcon, StarIcon, StarFilledIcon, SunIcon,
} from "@radix-ui/react-icons";

const icons = {
  arrow: ArrowRightIcon, camera: CameraIcon, down: ChevronDownIcon,
  chevron: ChevronRightIcon, close: Cross2Icon, location: GlobeIcon,
  collection: ImageIcon, search: MagnifyingGlassIcon, moon: MoonIcon,
  star: StarIcon, mark: StarFilledIcon, sun: SunIcon,
};

export type SkyIconName = keyof typeof icons;

export function SkyIcon({ name, ...props }: Omit<SVGProps<SVGSVGElement>, "children"> & { name: SkyIconName }) {
  const Icon = icons[name];
  return <Icon {...props} aria-hidden="true" focusable="false" />;
}
