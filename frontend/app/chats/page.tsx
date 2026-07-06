import { MessageCircle } from "lucide-react";

// Shown in the main pane on desktop when no chat is selected (WhatsApp Web's
// splash). On mobile the sidebar occupies the screen instead.
export default function ChatsIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-wa-panel text-center">
      <div className="flex size-24 items-center justify-center rounded-full bg-wa-green/10">
        <MessageCircle size={48} className="text-wa-green" />
      </div>
      <h1 className="mt-6 text-2xl font-light text-wa-ink">WhatsApp+</h1>
      <p className="mt-2 max-w-sm text-sm text-wa-subtle">
        Select a conversation to start messaging, or add a contact and start a
        new chat. Messages are delivered in real time.
      </p>
    </div>
  );
}
