interface PanelWrapperProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function PanelWrapper({ title, icon, children, actions }: PanelWrapperProps) {
  return (
    <div className="bg-gunmetal-950/50 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-neon-turquoise">
              {icon}
            </div>
          )}
          <h2 className="text-2xl font-bold gradient-text">
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