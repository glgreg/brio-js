import "./styles/base.css";
import "./styles/landing.css";
import { mountChrome } from "./chrome";
import { capySVG } from "./mascot";

mountChrome("home");
document.getElementById("notfound-capy")!.innerHTML = capySVG({ pose: "sleep" });
