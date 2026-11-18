import { AppShell } from "@/components/app-shell";

export function PageFrame({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <AppShell>
      <div className="content">
        <div className="title-row">
          <div><div className="eyebrow">Workspace</div><h1>{title}</h1><p className="subtitle">{description}</p></div>
        </div>
        {children ?? <div className="card section-card"><div className="empty"><strong>Foundation ready</strong>This workspace will be activated in the current milestone.</div></div>}
      </div>
    </AppShell>
  );
}
