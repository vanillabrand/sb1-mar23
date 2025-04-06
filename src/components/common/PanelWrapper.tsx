interface PanelWrapperProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function PanelWrapper({ title, icon, children, actions }: PanelWrapperProps) {
  return (
    <div className="panel-metallic backdrop-blur-sm rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-neon-turquoise">
              {icon}
            </div>
          )}
          <h2 className="gradient-text">
            {title}
          </h2>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}