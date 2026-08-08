import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Nombre de la seccion, para que el aviso diga donde ocurrio. */
  section?: string;
}

interface State {
  error: Error | null;
  componentStack: string;
}

/**
 * Sin esto, cualquier excepcion durante el render desmonta toda la aplicacion y
 * el usuario solo ve el fondo negro del body, sin ninguna pista de que paso.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack || '' });
    console.error('[Lighthouse] Error no controlado', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null, componentStack: '' });

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl border border-lh-border bg-lh-card rounded-md p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="font-semibold">
              No fue posible mostrar {this.props.section || 'esta sección'}
            </h2>
          </div>

          <p className="text-sm text-lh-muted mt-3">
            El resto del panel sigue disponible desde el menú. Si el problema continúa,
            comparta el detalle de abajo con el equipo técnico.
          </p>

          <pre className="mt-4 p-3 bg-lh-bg border border-lh-border rounded-md text-xs text-amber-200 overflow-auto max-h-64 whitespace-pre-wrap">
            {error.message}
            {componentStack ? `\n${componentStack.trim()}` : ''}
          </pre>

          <button
            onClick={this.reset}
            className="mt-5 h-9 px-4 flex items-center gap-2 text-sm bg-lh-gold text-lh-bg rounded-md font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}
