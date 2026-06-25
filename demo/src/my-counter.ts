/**
 * A simple counter web component.
 *
 * @element my-counter
 *
 * @fires count-changed - Fired when the count changes. Detail: `{ count: number }`
 */
export class MyCounter extends HTMLElement {
  /** The current count value. */
  count = 0;

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.render();
    this.shadowRoot!.querySelector("button")!.addEventListener("click", () => {
      this.count++;
      this.render();
      this.dispatchEvent(new CustomEvent("count-changed", { detail: { count: this.count }, bubbles: true }));
    });
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        button { font-size: 1rem; padding: 0.25rem 0.75rem; cursor: pointer; }
        span { margin-left: 0.5rem; font-weight: bold; }
      </style>
      <button type="button">Increment</button>
      <span>${this.count}</span>
    `;
  }
}

customElements.define("my-counter", MyCounter);
