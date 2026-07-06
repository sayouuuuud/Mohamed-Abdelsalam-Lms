import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, CheckCircle2 } from 'lucide-react'
import { PanelCard } from './panel-card'
import { getInitials } from '@/lib/get-initials'

export function LatestMessages({ messages = [] }: { messages?: any[] }) {
  return (
    <PanelCard title="آخر الرسائل" action="عرض الكل" actionHref="/admin/messages">
      <ul className="space-y-3">
        {messages.slice(0, 3).map((msg, i) => (
          <li key={i} className="flex items-start gap-3 py-3 first:pt-0">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(msg.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{msg.name}</p>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  {msg.time}
                  {msg.unread && (
                    <span className="size-2 rounded-full bg-primary" aria-label="غير مقروءة" />
                  )}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
