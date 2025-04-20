interface PanelWrapperProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function PanelWrapper({ title, icon, children, actions }: PanelWrapperProps) {
  return (
    <div className="panel-metallic rounded-xl p-3 sm:p-4 md:p-5">
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