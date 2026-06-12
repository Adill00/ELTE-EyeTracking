const DEFAULT_STYLES = `
.eye-tracking-pointer {
  position: fixed;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 50, 50, 0.6);
  border: 2px solid rgba(255, 50, 50, 0.9);
  pointer-events: none;
  z-index: 2147483645;
  transform: translate(-50%, -50%);
  transition: left 0.05s linear, top 0.05s linear;
  display: none;
}
`;

export class GazePointer {
  private el: HTMLDivElement;
  private styleEl: HTMLStyleElement;

  constructor() {
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = DEFAULT_STYLES;
    document.head.appendChild(this.styleEl);

    this.el = document.createElement('div');
    this.el.className = 'eye-tracking-pointer';
    document.body.appendChild(this.el);
  }

  update(x: number, y: number): void {
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? 'block' : 'none';
  }
}
