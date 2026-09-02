// Runtime notification-type registry, mirroring #218's registerEventType() convention.
// A type must be registered before NotificationFactory().notify() will accept it.
const registeredTypes = new Set<string>();

// @spec NOTIF-011
const registerNotificationType = (type: string): void => {
  registeredTypes.add(type);
};

const isRegisteredNotificationType = (type: string): boolean => registeredTypes.has(type);

export { registerNotificationType, isRegisteredNotificationType };
