/**
 * A greeting web component.
 *
 * @element my-greeting
 */
export class MyGreeting extends HTMLElement {
  static observedAttributes = ["name"];

  /** The name to greet. */
  get name(): string {
    return this.getAttribute("name") ?? "stranger";
  }

  set name(value: string) {
    this.setAttribute("name", value);
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.shadowRoot!.innerHTML = `<p>Hello, <strong>${this.name}</strong>!</p>`;
  }
}

customElements.define("my-greeting", MyGreeting);
