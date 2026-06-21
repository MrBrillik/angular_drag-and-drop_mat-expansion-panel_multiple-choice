import { Component, Input, computed, WritableSignal, inject } from '@angular/core';
import {
  CdkDrag,
  CdkDropList,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
  CdkDragHandle
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
  imports: [CommonModule, MatExpansionModule, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    <mat-expansion-panel [expanded]="true" class="project-panel">
      
      <mat-expansion-panel-header>
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
        (cdkDropListDropped)="drop($event)"
        class="node-body"
        [ngClass]="{
          'local-sort-active': dragService.mode() === 'local' && dragService.activeParentId() === project.id
        }"
      >
        @for (child of children(); track child.id) {
          <div 
            cdkDrag 
            [cdkDragData]="child"
            [cdkDragBoundary]="dragService.mode() === 'local' ? boundaryRef : ''"
            (cdkDragEnded)="dragService.clearDrag()"
            (click)="onNodeClick($event, child.id)"
            class="drag-item-wrapper"
            [ngClass]="{ 'selected-node-active': dragService.isSelected(child.id) }"
          >
            <!-- Контейнер для кнопок -->
            <div class="handles-container">
              <!-- Кнопка 1: Полный перенос -->
              <span 
                cdkDragHandle 
                class="drag-handle move-handle" 
                title="Переместить в другой проект"
                (mousedown)="dragService.startDrag('all', project.id)"
                (touchstart)="dragService.startDrag('all', project.id)"
              >☰</span>

              <!-- Кнопка 2: Только сортировка внутри текущего уровня -->
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
        transition: background-color 0.2s;
      }
      
      /* Стилизация выделенного по Ctrl+Клик элемента */
      .drag-item-wrapper.selected-node-active {
        background-color: rgba(33, 150, 243, 0.08);
        border-left: 4px solid #2196f3;
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
        min-height: 40px;
        background: rgba(0,0,0,0.01);
        border: 1px dashed transparent;
        transition: border 0.2s, background-color 0.2s;
      }

      .node-body.local-sort-active {
        background-color: rgba(76, 175, 80, 0.06);
        border: 2px dashed #4caf50;
      }

      .cdk-drop-list-receiving { 
        border-color: #3f51b5; 
        background-color: rgba(63, 81, 181, 0.04);
      }
      
      .cdk-drag-preview {
        background: white;
        border-radius: 4px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        opacity: 0.9;
      }
      .cdk-drag-placeholder { opacity: 0.2; }
    `,
  ],
})
export class ProjectNodeComponent {
  @Input() project!: Project;
  @Input() childrenMap!: WritableSignal<Record<string, Project[]>>;
  @Input() allDropLists!: () => string[];
  @Input() currentParentId: string = 'root';

  protected dragService = inject(ProjectDragService);

  get isRoot(): boolean {
    return this.project.id === 'root';
  }

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

  /**
   * Обработка клика по узлу. Если зажат Ctrl (или Meta на Mac), переключаем выделение.
   * Иначе — сбрасываем выделение (стандартное поведение ОС).
   */
  onNodeClick(event: MouseEvent, childId: string) {
    if (event.ctrlKey || event.metaKey) {
      event.stopPropagation(); // Чтобы клик не раскрывал/сворачивал mat-expansion-panel
      this.dragService.toggleSelection(childId, this.project.id);
    } else {
      // Обычный клик без Ctrl снимает выделение со всей группы
      this.dragService.clearSelection();
    }
  }

  private getParentIdFromListId(listId: string): string {
    return listId.replace('body-', '');
  }

  drop(event: CdkDragDrop<Project[]>) {
    const prevParentId = this.getParentIdFromListId(event.previousContainer.id);
    const newParentId = this.getParentIdFromListId(event.container.id);
    const draggedItem = event.item.data as Project;

    // В режиме local запрещаем межконтейнерные операции на всякий случай
    if (this.dragService.mode() === 'local' && prevParentId !== newParentId) {
      this.dragService.clearSelection();
      return;
    }

    // Собираем список перетаскиваемых проектов.
    // Если перетаскиваемый элемент был выделен, берем всю группу выделенных.
    // Если его не выделяли через Ctrl, тащим только его одного.
    const isGroupDrag = this.dragService.isSelected(draggedItem.id);
    const selectedIds = isGroupDrag ? this.dragService.selectedIds() : [draggedItem.id];

    // Массив объектов, которые мы реально перемещаем
    const currentPrevItems = this.childrenMap()[prevParentId] ?? [];
    const itemsToMove = currentPrevItems.filter(item => selectedIds.includes(item.id));

    // Проверка на циклическую вложенность (нельзя кинуть родителя в его ребенка)
    for (const item of itemsToMove) {
      if (this.isDescendant(item.id, newParentId)) {
        this.dragService.clearSelection();
        return;
      }
    }

    this.childrenMap.update((map) => {
      const nextMap = { ...map };
      const sourceList = [...(nextMap[prevParentId] ?? [])];

      // Исключаем перемещаемые элементы из исходного списка
      const cleanSourceList = sourceList.filter(item => !selectedIds.includes(item.id));

      if (prevParentId === newParentId) {
        // СЛУЧАЙ 1: Сортировка (внутри одного родителя)
        // Определяем индекс, куда пользователь бросил элемент, в очищенном списке
        let targetIndex = event.currentIndex;

        // Вставляем пачку элементов в целевую позицию
        cleanSourceList.splice(targetIndex, 0, ...itemsToMove);
        nextMap[prevParentId] = cleanSourceList;
      } else {
        // СЛУЧАЙ 2: Перенос к другому родителю
        const targetList = [...(nextMap[newParentId] ?? [])];
        let targetIndex = event.currentIndex;

        targetList.splice(targetIndex, 0, ...itemsToMove);

        nextMap[prevParentId] = cleanSourceList;
        nextMap[newParentId] = targetList;
      }

      return nextMap;
    });

    // Очищаем выделение после успешного дропа
    this.dragService.clearSelection();
  }

  private isDescendant(parentId: string, childId: string): boolean {
    if (parentId === childId) return true;
    const children = this.childrenMap()[parentId] ?? [];
    return children.some(child => this.isDescendant(child.id, childId));
  }
}
