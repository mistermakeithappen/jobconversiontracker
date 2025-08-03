// Common styles for all workflow nodes to ensure consistency and readability

export const inputStyles = {
  base: "w-full px-3 py-2 text-sm font-normal border rounded-md transition-all duration-200",
  colors: "bg-white text-gray-900 placeholder-gray-400 border-gray-300",
  focus: "focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none",
  hover: "hover:border-gray-400",
  get full() {
    return `${this.base} ${this.colors} ${this.focus} ${this.hover}`;
  }
};

export const textareaStyles = {
  ...inputStyles,
  base: "w-full px-3 py-2 text-sm font-normal border rounded-md transition-all duration-200 resize-none",
  get full() {
    return `${this.base} ${this.colors} ${this.focus} ${this.hover}`;
  }
};

export const selectStyles = {
  ...inputStyles,
  base: "w-full px-3 py-2 text-sm font-normal border rounded-md transition-all duration-200 cursor-pointer",
  get full() {
    return `${this.base} ${this.colors} ${this.focus} ${this.hover}`;
  }
};

export const labelStyles = "text-xs font-semibold text-gray-800 uppercase tracking-wider";

export const checkboxStyles = "w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer";

export const displayTextStyles = {
  value: "text-sm font-medium text-gray-900",
  placeholder: "text-sm text-gray-400 italic",
  label: "text-xs font-medium text-gray-600"
};