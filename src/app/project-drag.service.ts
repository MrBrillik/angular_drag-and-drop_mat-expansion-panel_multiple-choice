import { Injectable, signal } from '@angular/core';

export type DragMode = 'all' | 'local';

@Injectable({
    providedIn: 'root',
})
export class ProjectDragService {
    mode = signal<DragMode>('all');
    activeParentId = signal<string | null>(null);

    // Массив ID выбранных проектов
    selectedIds = signal<string[]>([]);
    // ID родителя, из которого сейчас выбраны элементы
    selectedParentId = signal<string | null>(null);

    startDrag(mode: DragMode, parentId: string) {
        this.mode.set(mode);
        this.activeParentId.set(parentId);
    }

    clearDrag() {
        this.mode.set('all');
        this.activeParentId.set(null);
    }

    /**
     * Логика выделения элементов по Ctrl + Клик
     */
    toggleSelection(projectId: string, parentId: string) {
        // Если выделяем элемент из другого родителя — сбрасываем старое выделение
        if (this.selectedParentId() !== parentId) {
            this.selectedIds.set([projectId]);
            this.selectedParentId.set(parentId);
            return;
        }

        const currentSelected = this.selectedIds();
        if (currentSelected.includes(projectId)) {
            // Убираем выделение, если уже выделен
            const updated = currentSelected.filter(id => id !== projectId);
            this.selectedIds.set(updated);
            if (updated.length === 0) {
                this.selectedParentId.set(null);
            }
        } else {
            // Добавляем в список выделенных
            this.selectedIds.set([...currentSelected, projectId]);
        }
    }

    clearSelection() {
        this.selectedIds.set([]);
        this.selectedParentId.set(null);
    }

    isSelected(projectId: string): boolean {
        return this.selectedIds().includes(projectId);
    }
}
