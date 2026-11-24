import {catalogSummary,saveRoomCounts} from './room-catalog.js?v=20261123-room-realism';

export function createRoomEditor(dialog, onRoom, onSaved) {
  const form = dialog.querySelector('form');
  const {capacity, computerCount} = form.elements;
  const submit = form.querySelector('[type="submit"]');
  const cancel = form.querySelector('[data-cancel]');
  const feedback = form.querySelector('[role="alert"]');
  let before;
  let saving = false;

  function setSaving(value) {
    saving = value;
    submit.disabled = value;
    cancel.disabled = value;
    capacity.readOnly = value;
    computerCount.readOnly = value;
    submit.textContent = value ? 'Сохраняем…' : 'Сохранить';
  }

  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    if (saving) event.preventDefault();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    const after = {
      capacity: capacity.value === '' ? null : capacity.valueAsNumber,
      computerCount: computerCount.value === '' ? null : computerCount.valueAsNumber,
    };
    if (before.capacity === after.capacity && before.computerCount === after.computerCount) {
      dialog.close();
      return;
    }

    feedback.textContent = '';
    setSaving(true);
    try {
      const result = await saveRoomCounts(before, after);
      if (result.conflict) {
        if (after.capacity === before.capacity) capacity.value = result.conflict.capacity ?? '';
        if (after.computerCount === before.computerCount) computerCount.value = result.conflict.computerCount ?? '';
        before = result.conflict;
        onRoom(before);
        feedback.textContent = `Данные уже изменились. Сейчас в каталоге: ${catalogSummary(before)} Сверьте значения перед повторным сохранением.`;
        return;
      }
      onRoom(result.room);
      dialog.close();
      onSaved();
    } catch {
      feedback.textContent = 'Не удалось получить подтверждение сохранения. Повторите попытку.';
    } finally {
      setSaving(false);
      if (dialog.open) feedback.focus();
    }
  });

  return (room) => {
    before = room;
    dialog.querySelector('h2').textContent = `Оснащение аудитории ${room.number}`;
    capacity.value = room.capacity ?? '';
    computerCount.value = room.computerCount ?? '';
    feedback.textContent = '';
    dialog.showModal();
  };
}
