import { Component, signal, computed, WritableSignal } from '@angular/core';
import { Project } from './project.interface';
import { ProjectNodeComponent } from './project-node.component';
import { DragDropService } from './drag-drop.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProjectNodeComponent],
  template: `
    <div class="tree-container">
      @if (rootProject(); as root) {
        <app-project-node
          [project]="root"
          [projectMapSignal]="projectMap" 
        />
      }
    </div>
  `,
  styles: [`
    .tree-container { padding: 20px; max-width: 600px; font-family: sans-serif; min-height: 500px; }
  `]
})
export class AppComponent {
  projectMap: WritableSignal<Record<string, Project[]>> = signal({
    __root__: [{ id: 'root', name: 'Корневой проект' }],
    root: [
      { id: '1', name: 'Проект 1' },
      { id: '2', name: 'Проект 2' },
    ],
    '1': [{ id: '3', name: 'Подпроект 1.1' }, { id: '4', name: 'Подпроект 1.2' }],
    '2': [{ id: '5', name: 'Подпроект 1.3' }, { id: '6', name: 'Подпроект 1.4' }],
    '3': [{ id: '7', name: 'Подпроект 3' }],
    '4': [], '5': [], '6': [], '7': [],
  });

  rootProject = computed(() => this.projectMap()['__root__']?.[0]);

  constructor(private dragDrop: DragDropService) {
    this.dragDrop.moveCallback = (ids, targetParentId, relativeToId, position) => {
      this.moveElements(ids, targetParentId, relativeToId, position);
    };
    this.dragDrop.getChildrenMap = () => this.projectMap();
  }

  private moveElements(ids: string[], targetParentId: string, relativeToId?: string, position?: 'before' | 'after' | 'inside') {
    this.projectMap.update(map => {
      const newMap = { ...map };
      const removedElements: Project[] = [];

      // СТРАХОВКА: Если по ошибке определился виртуальный __root__, перенаправляем в реальный root
      if (targetParentId === '__root__') {
        targetParentId = 'root';
      }

      // 1. Извлекаем переносимые элементы
      for (const [parentId, children] of Object.entries(newMap)) {
        const kept = children.filter(c => !ids.includes(c.id));
        const taken = children.filter(c => ids.includes(c.id));
        if (taken.length > 0) {
          removedElements.push(...taken);
          newMap[parentId] = kept;
        }
      }

      if (!newMap[targetParentId]) {
        newMap[targetParentId] = [];
      }

      const targetChildren = [...newMap[targetParentId]];

      // 2. Если вставляем внутрь папки (в пустую область или по центру заголовка)
      if (!relativeToId || position === 'inside') {
        targetChildren.push(...removedElements);
      } else {
        // 3. Если сортируем перед/после соседа
        const referenceIndex = targetChildren.findIndex(p => p.id === relativeToId);
        let insertIndex = targetChildren.length;

        if (referenceIndex !== -1) {
          insertIndex = position === 'after' ? referenceIndex + 1 : referenceIndex;
        }
        targetChildren.splice(insertIndex, 0, ...removedElements);
      }

      newMap[targetParentId] = targetChildren;
      return newMap;
    });
  }
}
