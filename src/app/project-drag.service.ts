import { Injectable, signal } from '@angular/core';

export type DragMode = 'all' | 'local';

@Injectable({
    providedIn: 'root',
})
export class ProjectDragService {
    mode = signal<DragMode>('all');
    activeParentId = signal<string | null>(null);

    // Массив ID выбранных проектов (Ctrl+клик)
    selectedIds = signal<string[]>([]);
    selectedParentId = signal<string | null>(null);

    startDrag(mode: DragMode, parentId: string) {
        this.mode.set(mode);
        this.activeParentId.set(parentId);
    }

    clearDrag() {
        this.mode.set('all');
        this.activeParentId.set(null);
    }

    toggleSelection(projectId: string, parentId: string) {
        if (this.selectedParentId() !== parentId) {
            this.selectedIds.set([projectId]);
            this.selectedParentId.set(parentId);
            return;
        }

        const current = this.selectedIds();
        if (current.includes(projectId)) {
            const updated = current.filter(id => id !== projectId);
            this.selectedIds.set(updated);
            if (updated.length === 0) {
                this.selectedParentId.set(null);
            }
        } else {
            this.selectedIds.set([...current, projectId]);
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