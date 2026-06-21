import { Component, computed, signal, WritableSignal } from '@angular/core';
import { Project, ProjectNodeComponent } from './project-node.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProjectNodeComponent],
  template: `
    <div class="tree-container">
      @if (rootProject(); as root) {
        <app-project-node
          [project]="root"
          [childrenMap]="projectMap"
          [allDropLists]="allDropLists"
        />
      }
    </div>
  `,
  styles: [`
    .tree-container { padding: 20px; max-width: 600px; }
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
    '3': [],
  });

  rootProject = computed(() => this.projectMap()['__root__']?.[0]);

  // Автоматически собирает ID всех существующих в мапе списков для связи cdkDropList
  allDropLists = computed(() => {
    return Object.keys(this.projectMap()).map(id => `body-${id}`);
  });
}