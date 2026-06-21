import { Component, Input, computed, WritableSignal, inject, signal } from '@angular/core';
import {
  CdkDrag,
  CdkDropList,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview
} from '@angular/cdk/drag-drop';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { ProjectDragService } from './project-drag.service';

export interface Project {
  id: string;
  name: string;
}

@Component({
  selector: 'app-project-node',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview
  ],
  template: `
    <mat-expansion-panel #panel [expanded]="isExpanded()" class="project-panel">

      <!-- Заголовок -->
      <mat-expansion-panel-header
        (mousedown)="onHeaderMouseDown($event, panel)"
        (touchstart)="onHeaderTouchStart($event, panel)"
      >
        <mat-panel-title>
          <span class="project-name">{{ project.name }}</span>
        </mat-panel-title>
      </mat-expansion-panel-header>

      <!-- Зона ТЕЛА (Drop List) -->
      <div
        cdkDropList
        #boundaryRef
        [id]="bodyListId"
        [cdkDropListData]="children()"
        [cdkDropListConnectedTo]="getConnectedLists()"
        [cdkDropListDisabled]="isListDisabled()"
        [cdkDropListSortPredicate]="sortPredicate"
        (cdkDropListDropped)="drop($event)"
        class="node-body"
        [class.empty]="children().length === 0"
        [ngClass]="{
          'local-sort-active': dragService.mode() === 'local' && dragService.activeParentId() === project.id
        }"
      >
        <!-- Подсказка для пустого списка (отображается только когда нет детей и нет перетаскивания) -->
        @if (children().length === 0 && !dragService.activeParentId()) {
          <div class="empty-hint">
            Перетащите проект сюда
          </div>
        }

        @for (child of children(); track child.id) {
          <div
            cdkDrag
            [cdkDragData]="child"
            [cdkDragBoundary]="dragService.mode() === 'local' ? boundaryRef : ''"
            (cdkDragEnded)="dragService.clearDrag()"
            class="drag-item-wrapper"
            [ngClass]="{ 'selected-node-active': dragService.isSelected(child.id) }"
          >
            <!-- ПРЕВЬЮ под курсором -->
            <ng-template cdkDragPreview>
              <div class="custom-drag-preview">
                Будет вставлено {{ getDraggedCount(child.id) }} элементов
              </div>
            </ng-template>

            <!-- ПЛЕЙСХОЛДЕР места вставки -->
            <ng-template cdkDragPlaceholder>
              <div class="custom-multi-placeholder" [ngClass]="{ 'hide-placeholder': isSortingForbidden() }">
                <div class="placeholder-badge">
                  Место для {{ getDraggedCount(child.id) }} эл.
                </div>
              </div>
            </ng-template>

            <!-- Контейнер для кнопок -->
            <div class="handles-container">
              <!-- Кнопка 1: Полный перенос (☰) -->
              <span
                cdkDragHandle
                class="drag-handle move-handle"
                title="Переместить в другой проект"
                (mousedown)="dragService.startDrag('all', project.id)"
                (touchstart)="dragService.startDrag('all', project.id)"
              >☰</span>

              <!-- Кнопка 2: Только сортировка (↕) -->
              <span
                cdkDragHandle
                class="drag-handle sort-handle"
                title="Изменить порядок в текущем проекте"
                (mousedown)="dragService.startDrag('local', project.id)"
                (touchstart)="dragService.startDrag('local', project.id)"
              >↕</span>
            </div>

            <!-- Вложенный узел -->
            <app-project-node
              [project]="child"
              [childrenMap]="childrenMap"
              [allDropLists]="allDropLists"
              [currentParentId]="project.id"
              class="nested-node"
            />
          </div>
        }
      </div>
    </mat-expansion-panel>
  `,
  styles: [
    `
      :host { display: block; margin-bottom: 8px; }

      .drag-item-wrapper {
        position: relative;
        margin-bottom: 10px;
        transition: background-color 0.2s, opacity 0.2s, transform 0.2s;
        user-select: none;
      }

      .drag-item-wrapper.selected-node-active {
        background-color: rgba(33, 150, 243, 0.08);
        border-left: 4px solid #2196f3;
      }

      /* Скрытие перетаскиваемых элементов (визуально) */
      :host ::ng-deep .cdk-drop-list-dragging .drag-item-wrapper.selected-node-active,
      :host ::ng-deep .drag-item-wrapper.cdk-drag-dragging {
        opacity: 0 !important;
        transform: scale(0) !important;
        pointer-events: none !important;
        transition: opacity 0.15s, transform 0.15s;
      }

      .handles-container {
        position: absolute;
        left: 28px;
        top: 12px;
        z-index: 999;
        display: flex;
        gap: 4px;
      }

      .drag-handle {
        cursor: move;
        padding: 2px 8px;
        border-radius: 4px;
        background: #ffffff;
        border: 1px solid #ccc;
        user-select: none;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      .drag-handle:hover { background: #f5f5f5; }
      .move-handle { color: #3f51b5; border-color: #3f51b5; }
      .sort-handle { color: #4caf50; border-color: #4caf50; }

      .nested-node ::ng-deep .mat-content {
        padding-left: 60px;
      }

      .node-body {
        padding-left: 12px;
        min-height: 60px; /* Увеличена для удобства перетаскивания в пустой список */
        background: rgba(0,0,0,0.01);
        border: 2px dashed transparent;
        transition: border 0.2s, background-color 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        position: relative;
      }

      /* Когда список пуст, показываем подсказку и делаем зону более заметной */
      .node-body.empty {
        border-color: #e0e0e0;
        background: rgba(0,0,0,0.02);
        justify-content: center;
        align-items: center;
        min-height: 80px;
      }

      .node-body.empty .empty-hint {
        color: #aaa;
        font-size: 14px;
        user-select: none;
        pointer-events: none;
      }

      /* Подсветка при перетаскивании над пустым списком */
      .node-body.cdk-drop-list-receiving.empty {
        border-color: #3f51b5;
        background: rgba(63, 81, 181, 0.05);
      }

      .node-body.local-sort-active {
        background-color: rgba(76, 175, 80, 0.06);
        border: 2px dashed #4caf50;
      }

      .cdk-drop-list-receiving {
        border-color: #3f51b5;
        background-color: rgba(63, 81, 181, 0.04);
      }

      .custom-multi-placeholder {
        background: #fafafa;
        border: 2px dashed #2196f3;
        min-height: 46px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
      }

      .custom-multi-placeholder.hide-placeholder {
        display: none !important;
      }

      .placeholder-badge {
        background: #2196f3;
        color: white;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }

      .custom-drag-preview {
        background: #2196f3;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 5px 15px rgba(33, 150, 243, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }
    `
  ],
})
export class ProjectNodeComponent {
  @Input() project!: Project;
  @Input() childrenMap!: WritableSignal<Record<string, Project[]>>;
  @Input() allDropLists!: () => string[];
  @Input() currentParentId: string = 'root';

  protected dragService = inject(ProjectDragService);

  isExpanded = signal(true);

  get bodyListId(): string {
    return `body-${this.project.id}`;
  }

  children = computed(() => this.childrenMap()[this.project.id] ?? []);

  getConnectedLists(): string[] {
    if (this.dragService.mode() === 'local') {
      return [this.bodyListId];
    }
    return this.allDropLists();
  }

  isListDisabled = computed(() => {
    if (this.dragService.mode() === 'local') {
      return this.dragService.activeParentId() !== this.project.id;
    }
    return false;
  });

  sortPredicate = (): boolean => {
    if (this.dragService.mode() === 'local') {
      return this.dragService.activeParentId() === this.project.id;
    }
    return false;
  };

  onHeaderMouseDown(event: MouseEvent, panel: any) {
    if (event.button !== 0) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      this.dragService.toggleSelection(this.project.id, this.currentParentId);
      return;
    }

    this.isExpanded.update(v => !v);

    const target = event.target as HTMLElement;
    if (!target.classList.contains('drag-handle')) {
      this.dragService.clearSelection();
    }
  }

  onHeaderTouchStart(event: TouchEvent, panel: any) {
    if (event.ctrlKey || event.metaKey) {
      event.stopPropagation();
      this.dragService.toggleSelection(this.project.id, this.currentParentId);
    }
  }

  isSortingForbidden(): boolean {
    return this.dragService.mode() === 'all' && this.dragService.activeParentId() === this.project.id;
  }

  getDraggedCount(childId: string): number {
    const isSelected = this.dragService.isSelected(childId);
    return isSelected && this.dragService.selectedIds().length > 1
      ? this.dragService.selectedIds().length
      : 1;
  }

  private getParentIdFromListId(listId: string): string {
    return listId.replace('body-', '');
  }

  drop(event: CdkDragDrop<Project[]>) {
    const prevParentId = this.getParentIdFromListId(event.previousContainer.id);
    const newParentId = this.getParentIdFromListId(event.container.id);
    const draggedItem = event.item.data as Project;

    if (this.dragService.mode() === 'all' && prevParentId === newParentId) {
      this.dragService.clearSelection();
      return;
    }

    if (this.dragService.mode() === 'local' && prevParentId !== newParentId) {
      this.dragService.clearSelection();
      return;
    }

    const isGroupDrag = this.dragService.isSelected(draggedItem.id);
    const selectedIds = isGroupDrag ? this.dragService.selectedIds() : [draggedItem.id];

    const currentPrevItems = this.childrenMap()[prevParentId] ?? [];
    const itemsToMove = currentPrevItems.filter(item => selectedIds.includes(item.id));

    for (const item of itemsToMove) {
      if (this.isDescendant(item.id, newParentId)) {
        this.dragService.clearSelection();
        return;
      }
    }

    this.childrenMap.update((map) => {
      const nextMap = { ...map };
      const sourceList = [...(nextMap[prevParentId] ?? [])];
      const cleanSourceList = sourceList.filter(item => !selectedIds.includes(item.id));

      if (prevParentId === newParentId) {
        let targetIndex = event.currentIndex;
        cleanSourceList.splice(targetIndex, 0, ...itemsToMove);
        nextMap[prevParentId] = cleanSourceList;
      } else {
        const targetList = [...(nextMap[newParentId] ?? [])];
        let targetIndex = event.currentIndex;
        targetList.splice(targetIndex, 0, ...itemsToMove);
        nextMap[prevParentId] = cleanSourceList;
        nextMap[newParentId] = targetList;
      }

      return nextMap;
    });

    this.dragService.clearSelection();
  }

  private isDescendant(parentId: string, childId: string): boolean {
    if (parentId === childId) return true;
    const children = this.childrenMap()[parentId] ?? [];
    return children.some(child => this.isDescendant(child.id, childId));
  }
}