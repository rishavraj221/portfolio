import type { ChatMessage } from "./types";

// Notification.requestPermission() isn't gesture-gated the way autoplay is,
// but firing it unprompted on page load reads as spammy and some browsers
// quietly ignore it anyway — call this from an actual click handler
// (Register's submit) instead.
export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

// tag: message.from collapses rapid-fire messages from the same person into
// one notification instead of stacking a pile of them, same as most chat
// apps' default behavior.
export function notifyMessage(message: ChatMessage, onClick: () => void) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const notification = new Notification(message.from, {
    body: message.body,
    tag: message.from,
  });

  notification.onclick = () => {
    window.focus();
    onClick();
    notification.close();
  };
}
