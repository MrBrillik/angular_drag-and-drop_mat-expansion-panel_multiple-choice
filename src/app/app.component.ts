import { Component, signal, computed, WritableSignal } from '@angular/core';
import { Project } from './project.interface';
import { ProjectNodeComponent } from './project-node.component';
import { DragDropService } from './drag-drop.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProjectNodeComponent],
  template: `
    <div class="tree-container" data-drop-zone-id="__root__">
      @if (rootProject(); as root) {
        <app-project-node
          [project]="root"
          [projectMapSignal]="projectMap" 
        />
      }
    </div>
  `,
  styles: [`
    .tree-container { padding: 20px; max-width: 600px; font-family: sans-serif; }
  `]
})
export class AppComponent {
  // Наша реактивная база данных дерева
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
    // Привязываем коллбеки к сервису с сохранением контекста
    this.dragDrop.moveCallback = (ids, targetParentId) => this.moveElements(ids, targetParentId);
    this.dragDrop.getChildrenMap = () => this.projectMap();
  }

  private moveElements(ids: string[], targetParentId: string) {
    this.projectMap.update(map => {
      const newMap = { ...map };
      const removedElements: Project[] = [];

      // 1. Извлекаем все переносимые элементы из их текущих позиций
      for (const [parentId, children] of Object.entries(newMap)) {
        const kept = children.filter(c => !ids.includes(c.id));
        const taken = children.filter(c => ids.includes(c.id));

        if (taken.length > 0) {
          removedElements.push(...taken);
          newMap[parentId] = kept;
        }
      }

      // 2. Инициализируем целевую папку, если она пустая
      if (!newMap[targetParentId]) {
        newMap[targetParentId] = [];
      }

      // 3. Вставляем элементы в новую целевую папку
      newMap[targetParentId] = [...newMap[targetParentId], ...removedElements];

      return newMap;
    });
  }
}
