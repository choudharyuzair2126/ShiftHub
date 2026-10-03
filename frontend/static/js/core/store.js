export function reactive(state, onChange) {
  return new Proxy(state, {
    set(target, key, value) {
      target[key] = value;
      onChange && onChange(key, value);
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      onChange && onChange(key, undefined);
      return true;
    },
  });
}

export const session = {
  user: null,
  token: localStorage.getItem("sh_token") || "",
};