import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "./App";
import "./styles/tailwind.css";
import "./styles/site.css";

export const createRoot = ViteReactSSG({ routes });
