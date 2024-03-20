import type { Disposable } from "vscode";

export function disposeAll(disposables: Disposable[]): void {
  while (disposables.length) {
    const item = disposables.pop();
    if (item) {
      item.dispose();
    }
  }
}

export abstract class DisposableBase implements Disposable {
  private _isDisposed = false;

  protected _disposables: Disposable[] = [];

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    disposeAll(this._disposables);
  }

  protected _register<T extends Disposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
    } else {
      this._disposables.push(disposable);
    }

    return disposable;
  }

  protected get isDisposed(): boolean {
    return this._isDisposed;
  }
}
