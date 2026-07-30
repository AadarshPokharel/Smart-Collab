export const getInitialSidebarOpen = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.innerWidth >= 1024;
};
