export function Toast({ message, tone }: { message: string; tone: 'ok' | 'error' }) {
  return (
    <div
      role="status"
      className={`fixed inset-x-0 bottom-8 z-40 mx-auto w-fit max-w-[90%] rounded-full px-4 py-2 text-sm font-semibold text-white shadow-raised ${
        tone === 'ok' ? 'bg-forest-700' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  );
}
